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
import type {
  SourceRow,
  TradingCatalog,
  TradingDataset,
  TradingResponse,
} from '../src/services/twse'
import catalogJSON from './fixtures/twse-catalog.json'

const catalog = catalogJSON as TradingCatalog
const routers: ReturnType<typeof createMemoryRouter>[] = []
// Synthetic contract rows; never loaded by the application.
const sourceRows: SourceRow[] = [
  {
    Date: '1151016',
    Code: '0050',
    Name: '測試證券甲',
    ClosingPrice: '123.4500',
    TradeVolume: '12345678901234567890',
  },
  {
    Date: '1151016',
    Code: '2330',
    Name: '測試證券乙',
    ClosingPrice: '0',
    TradeVolume: null,
  },
]

function payload(dataset: TradingDataset, rows = sourceRows): TradingResponse {
  return {
    dataset,
    columns: Object.keys(rows[0] ?? {}),
    data: rows,
    meta: {
      source: 'TWSE',
      source_url: dataset.source_url,
      retrieved_at: '2026-10-18T04:00:00Z',
      retrieval: 'on_request',
      freshness: 'source_defined',
      units: 'source_native',
      row_count: rows.length,
      note: '',
    },
  }
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async (path: string) => {
    if (path === '/api/v1/twse/datasets') return response(catalog)
    const dataset = catalog.data.find((item) => item.endpoint === path)
    return dataset ? response(payload(dataset)) : response({}, 404)
  })
  vi.stubGlobal('fetch', (path: string, ...args: unknown[]) =>
    path === '/api/v1/me'
      ? Promise.resolve(response({ error: { code: 'SESSION_INVALID' } }, 401))
      : fetchMock(path, ...args),
  )
})
afterEach(() => {
  cleanup()
  routers.splice(0).forEach((router) => router.dispose())
  vi.unstubAllGlobals()
})
function renderRoute(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  routers.push(router)
  render(<RouterProvider router={router} />)
  return router
}
const navigation = () =>
  within(screen.getByRole('navigation', { name: '主要導覽' }))

it('navigates between home, stocks, trading data and the existing demo watchlist', async () => {
  const router = renderRoute()
  await screen.findByRole('heading', { name: /看懂台股/ })
  expect(navigation().getByRole('link', { name: '首頁' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  fireEvent.click(navigation().getByRole('link', { name: '個股分析' }))
  await screen.findByRole('heading', { level: 1, name: '個股分析' })
  expect(navigation().getByRole('link', { name: '個股分析' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await waitFor(() => expect(screen.getByRole('main')).toHaveFocus())
  fireEvent.click(navigation().getByRole('link', { name: '交易資料' }))
  await screen.findByRole('heading', { level: 1, name: '交易資料' })
  fireEvent.click(navigation().getByRole('link', { name: '自選股' }))
  await screen.findByRole('heading', { level: 1, name: '自選股' })
  await act(() => router.navigate(-1))
  await screen.findByRole('heading', { level: 1, name: '交易資料' })
})

it.each(catalog.data)(
  'opens $id and requests its matching endpoint without cache',
  async (dataset) => {
    renderRoute(dataset.page_path)
    await screen.findByRole('heading', { level: 1, name: dataset.title })
    expect(fetchMock).toHaveBeenCalledWith(
      dataset.endpoint,
      expect.objectContaining({
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(
      within(screen.getByRole('table')).getByText('0050'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('table')).getByText('12345678901234567890'),
    ).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('0')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '官方資料來源 ↗' }),
    ).toHaveAttribute('href', dataset.source_url)
    expect(
      navigation().getByRole('link', { name: '交易資料' }),
    ).toHaveAttribute('aria-current', 'page')
  },
)

it('filters the complete result locally while preserving leading zeros and exact decimals', async () => {
  renderRoute('/market/daily-prices')
  await screen.findByRole('table')
  const calls = fetchMock.mock.calls.length
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '0050' } })
  expect(
    within(screen.getByRole('table')).getByText('123.4500'),
  ).toBeInTheDocument()
  expect(
    within(screen.getByRole('table')).queryByText('測試證券乙'),
  ).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(calls)
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: '找不到' },
  })
  expect(
    screen.getByRole('heading', { name: '沒有符合篩選的資料' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '清除篩選' }))
  expect(screen.getByRole('table')).toBeInTheDocument()
})

it('fetches again when returning to the same data page', async () => {
  renderRoute('/market/daily-prices')
  await screen.findByRole('table')
  fireEvent.click(navigation().getByRole('link', { name: '交易資料' }))
  await screen.findByRole('heading', { level: 1, name: '交易資料' })
  fireEvent.click(screen.getByRole('link', { name: '上市個股日成交資訊' }))
  await screen.findByRole('table')
  expect(
    fetchMock.mock.calls.filter(
      ([path]) => path === '/api/v1/twse/exchangeReport/STOCK_DAY_ALL',
    ),
  ).toHaveLength(2)
})

it('hides previous results during refresh and removes them after an upstream failure', async () => {
  renderRoute('/market/daily-prices')
  await screen.findByRole('table')
  let fail: (value: Response) => void = () => {}
  fetchMock.mockImplementation(async (path: string) =>
    path.endsWith('/datasets')
      ? response(catalog)
      : new Promise<Response>((resolve) => {
          fail = resolve
        }),
  )
  fireEvent.click(screen.getByRole('button', { name: '重新取得 TWSE 資料' }))
  await screen.findByRole('button', { name: '正在向 TWSE 取得…' })
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  await act(async () =>
    fail(
      response(
        { error: { code: 'SOURCE_UNAVAILABLE', request_id: 'test-request' } },
        503,
      ),
    ),
  )
  await screen.findByRole('alert')
  expect(
    screen.getByRole('heading', { name: '無法取得官方資料' }),
  ).toBeInTheDocument()
  expect(screen.queryByText('測試證券甲')).not.toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByText(/test-request/)).toBeInTheDocument()
})

it('distinguishes a valid empty response from a failed source request', async () => {
  fetchMock.mockImplementation(async (path: string) =>
    path.endsWith('/datasets')
      ? response(catalog)
      : response(payload(catalog.data[0], [])),
  )
  renderRoute('/market/daily-prices')
  await screen.findByRole('heading', { name: '官方本次回傳空資料' })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('shows tailored time series and event views with their complete tables', async () => {
  const index = catalog.data.find((item) => item.id === 'taiex-history')!
  const event = catalog.data.find((item) => item.id === 'market-calendar')!
  fetchMock.mockImplementation(async (path: string) => {
    if (path.endsWith('/datasets')) return response(catalog)
    if (path === index.endpoint)
      return response(
        payload(index, [
          { 日期: '1151015', 收盤指數: '20000' },
          { 日期: '1151016', 收盤指數: '21000' },
        ]),
      )
    return response(
      payload(event, [
        { 日期: '1150101', 名稱: '測試開休市事項', 說明: '測試事由' },
      ]),
    )
  })
  const router = renderRoute(index.page_path)
  await screen.findByRole('img', { name: /收盤指數資料序列/ })
  await act(() => router.navigate(event.page_path))
  await screen.findByRole('heading', { name: '日期與事項' })
  expect(screen.getByRole('table')).toBeInTheDocument()
})

it('searches catalogue functions without fetching all exchange datasets', async () => {
  renderRoute('/market')
  await screen.findByRole('heading', { level: 1, name: '交易資料' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '零股' } })
  expect(
    screen.getByRole('link', { name: '集中市場零股交易行情單' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: '上市個股日成交資訊' }),
  ).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('shows a missing dataset page and preserves navigation', async () => {
  renderRoute('/market/unknown')
  await screen.findByRole('heading', {
    level: 1,
    name: '找不到這個交易資料頁面',
  })
  expect(navigation().getAllByRole('link')).toHaveLength(5)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('retains the clearly labelled demo watchlist and old demo detail', async () => {
  const router = renderRoute('/watchlists')
  await screen.findByRole('heading', { level: 1, name: '自選股' })
  expect(router.state.location.pathname).toBe('/watchlists/demo')
  expect(fetchMock).not.toHaveBeenCalled()
  await act(() => router.navigate('/stocks/demo-honhai'))
  expect(
    screen.getByRole('heading', { level: 1, name: '鴻海' }),
  ).toBeInTheDocument()
  expect(screen.getAllByText(/假資料/).length).toBeGreaterThan(0)
})

it('keeps ordinary unknown routes as a missing page', async () => {
  renderRoute('/unknown')
  await waitFor(() =>
    expect(
      screen.getByRole('heading', { level: 1, name: '找不到這個頁面' }),
    ).toBeInTheDocument(),
  )
})
