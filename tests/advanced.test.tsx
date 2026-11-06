// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { routes } from '../src/app/routes'
import {
  loadAdvancedResearch,
  type AdvancedResearch,
  type ResearchBlock,
} from '../src/services/advanced'

const meta = {
  source: 'FinMind' as const,
  dataset: 'TaiwanStockPER',
  source_url: 'https://api.finmindtrade.com/api/v4/data',
  retrieved_at: '2026-07-31T08:00:00Z',
  query_start: '2026-01-01',
  query_end: '2026-07-31',
  row_count: 2,
  retrieval: 'on_request' as const,
  price_basis: null,
  units: {},
}
const block: ResearchBlock = {
  id: 'valuation',
  title: '歷史估值',
  required_plan: 'Free',
  columns: [
    { key: 'date', label: '日期' },
    { key: 'pe', label: '本益比（倍）' },
    { key: 'pb', label: '股價淨值比（倍）' },
    { key: 'yield', label: '殖利率（%）' },
  ],
  result: {
    status: 'ok',
    meta,
    error: null,
    data: [
      { date: '2026-07-01', pe: '20.1234', pb: '3', yield: '0' },
      { date: '2026-07-02', pe: null, pb: '4', yield: '2.5' },
    ],
  },
}
const fixture: AdvancedResearch = {
  code: '0050',
  name: '測試 ETF',
  topic: 'valuation',
  start_date: '2026-01-01',
  end_date: '2026-07-31',
  complete: true,
  notes: ['這是本次來源的觀察區間。'],
  blocks: [block],
}
const page =
  '/stocks/0050/research/valuation?start_date=2026-01-01&end_date=2026-07-31'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const fetchMock = vi.fn()
const routers: ReturnType<typeof createMemoryRouter>[] = []
beforeEach(() => {
  fetchMock.mockReset().mockImplementation(() => Promise.resolve(json(fixture)))
  vi.stubGlobal('fetch', (url: string, ...args: unknown[]) =>
    url === '/api/v1/me'
      ? Promise.resolve(json({ error: { code: 'SESSION_INVALID' } }, 401))
      : fetchMock(url, ...args),
  )
})
afterEach(() => {
  cleanup()
  routers.splice(0).forEach((router) => router.dispose())
  vi.unstubAllGlobals()
})
function renderPage(path = page) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  routers.push(router)
  render(<RouterProvider router={router} />)
  return router
}

it('loads one no-store request with the exact stock code and exposes all research topics', async () => {
  renderPage()
  await screen.findByRole('heading', {
    name: '測試 ETF · 歷史估值',
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/stocks/0050/research?topic=valuation&start_date=2026-01-01&end_date=2026-07-31',
    expect.objectContaining({ cache: 'no-store' }),
  )
  expect(
    within(
      screen.getByRole('navigation', { name: '個股研究項目' }),
    ).getAllByRole('link'),
  ).toHaveLength(9)
  expect(screen.getByText('20.1234')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '← 返回個股摘要' })).toHaveAttribute(
    'href',
    '/stocks/0050',
  )
})

it('switches numeric fields and filters the current response without fetching', async () => {
  renderPage()
  await screen.findByRole('img', { name: '歷史估值 · 本益比（倍）' })
  fireEvent.change(screen.getByLabelText('歷史估值圖表數值'), {
    target: { value: 'pb' },
  })
  expect(
    screen.getByRole('img', { name: '歷史估值 · 股價淨值比（倍）' }),
  ).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('歷史估值搜尋本次資料'), {
    target: { value: '2026-07-02' },
  })
  expect(screen.queryByText('20.1234')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('shows paid access errors distinctly from empty data and retains successful raw prices', async () => {
  const result = structuredClone(fixture)
  result.topic = 'adjusted'
  result.complete = false
  result.blocks = [
    {
      ...block,
      id: 'adjusted',
      title: '還原收盤價',
      required_plan: 'Backer',
      result: {
        status: 'error',
        data: null,
        meta: null,
        error: { code: 'FINMIND_ACCESS_DENIED', message: 'FinMind 存取受限。' },
      },
    },
    {
      ...block,
      id: 'prices',
      title: '原始收盤價',
      columns: [
        { key: 'date', label: '日期' },
        { key: 'close', label: '收盤價（元）' },
      ],
      result: {
        status: 'ok',
        meta,
        error: null,
        data: [{ date: '2026-07-01', close: '123.4500' }],
      },
    },
  ]
  fetchMock.mockImplementation(() => Promise.resolve(json(result)))
  renderPage('/stocks/0050/research/adjusted')
  await screen.findByText('Backer 資料權限')
  expect(screen.getByText('FinMind 存取受限。')).toBeInTheDocument()
  expect(screen.getByText('123.4500')).toBeInTheDocument()
  expect(
    screen.queryByText('來源在此查詢期間未提供資料。'),
  ).not.toBeInTheDocument()
})

it('clears old charts and exact rows while refreshing and after a failed request', async () => {
  renderPage()
  await screen.findByRole('img', { name: '歷史估值 · 本益比（倍）' })
  let release!: (value: Response) => void
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve
      }),
  )
  fireEvent.click(screen.getByRole('button', { name: '重新取得' }))
  await screen.findByRole('status')
  expect(screen.queryByText('20.1234')).not.toBeInTheDocument()
  await act(() =>
    release(json({ error: { code: 'FINMIND_UNAVAILABLE' } }, 503)),
  )
  await screen.findByRole('heading', { name: '研究資料無法取得' })
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('keeps one-day broker date forms consistent on submit', async () => {
  renderPage('/stocks/0050/research/brokers?end_date=2026-07-31')
  await screen.findByRole('heading', { name: '測試 ETF · 券商分點' })
  expect(fetchMock.mock.calls[0][0]).toContain(
    'start_date=2026-07-31&end_date=2026-07-31',
  )
  expect(screen.queryByLabelText('開始日期')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('查詢日期'), {
    target: { value: '2026-07-30' },
  })
  fireEvent.submit(
    screen.getByRole('button', { name: '查詢研究資料' }).closest('form')!,
  )
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  expect(fetchMock.mock.calls[1][0]).toContain(
    'start_date=2026-07-30&end_date=2026-07-30',
  )
})

it('rejects invalid codes/topics and cancels pending research without retry', async () => {
  const request = new Request(`http://localhost${page}`)
  expect(
    (
      await loadAdvancedResearch({
        params: { code: 'bad', topic: 'valuation' },
        request,
      })
    ).response,
  ).toBeNull()
  await expect(
    loadAdvancedResearch({
      params: { code: '0050', topic: 'anything' },
      request,
    }),
  ).rejects.toHaveProperty('status', 404)
  expect(fetchMock).not.toHaveBeenCalled()
  const controller = new AbortController()
  fetchMock.mockImplementation(async () => {
    controller.abort()
    throw controller.signal.reason
  })
  await expect(
    loadAdvancedResearch({
      params: { code: '0050', topic: 'etf' },
      request: new Request(`http://localhost${page}`, {
        signal: controller.signal,
      }),
    }),
  ).rejects.toThrow()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
