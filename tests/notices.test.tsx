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
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { routes } from '../src/app/routes'
import { StockRiskPanel } from '../src/components/StockRiskPanel'
import { upcomingDates } from '../src/services/notices'

const source = (id: string) => ({
  id,
  title: `來源 ${id}`,
  source_url: `https://openapi.twse.com.tw/v1/${id}`,
  status: 'ok',
  retrieved_at: '2026-10-23T04:00:00Z',
  row_count: 1,
  error: null,
})
const event = {
  id: 'event-0050',
  kind: 'ex_dividend',
  date: '2026-10-23',
  source_date: '1151023',
  code: '0050',
  name: '測試ETF',
  title: '0050 測試ETF · 除權息（息）',
  description: '現金股利：1.2500',
  fields: { CashDividend: '1.2500', Date: '1151023', Code: '0050' },
  source_url: 'https://openapi.twse.com.tw/v1/exchangeReport/TWT48U_ALL',
}
const notice = {
  id: 'notice-0050',
  kind: 'attention',
  code: '0050',
  name: '測試ETF',
  announced_on: '2026-10-22',
  date_label: '1151022',
  description: '注意原因原文',
  fields: {
    Code: '0050',
    TradingInfoForAttention: '注意原因原文',
    Date: '1151022',
  },
  source_url: 'https://openapi.twse.com.tw/v1/announcement/notice',
}
const calendarBody = {
  data: [event],
  pagination: { page: 1, limit: 20, total: 25 },
  complete: true,
  undated: 0,
  sources: [source('ex-dividend'), source('market-calendar')],
}
const riskBody = {
  data: [notice],
  pagination: { page: 1, limit: 20, total: 1 },
  complete: true,
  sources: [
    source('attention-securities'),
    source('disposition-securities'),
    source('suspended-securities'),
  ],
  note: '未列出不代表無其他風險或必然可交易。',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const fetchMock = vi.fn()
const routers: ReturnType<typeof createMemoryRouter>[] = []
beforeEach(() => {
  fetchMock
    .mockReset()
    .mockImplementation(async (path: string) =>
      path.startsWith('/api/v1/research/calendar')
        ? json(calendarBody)
        : json(riskBody),
    )
  vi.stubGlobal('fetch', (path: string, ...args: unknown[]) =>
    path === '/api/v1/me'
      ? Promise.resolve(json({ error: { code: 'SESSION_INVALID' } }, 401))
      : fetchMock(path, ...args),
  )
})
afterEach(() => {
  cleanup()
  routers.splice(0).forEach((router) => router.dispose())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function renderPath(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  routers.push(router)
  render(<RouterProvider router={router} />)
  return router
}

it('opens the official calendar with normalized and original dates and exact dividend strings', async () => {
  renderPath('/research/calendar')
  await screen.findByRole('heading', { level: 1, name: '除權息與交易日曆' })
  expect(screen.getByRole('heading', { name: event.title })).toBeInTheDocument()
  expect(screen.getByText('現金股利：1.2500')).toBeInTheDocument()
  expect(screen.getByText('2026-10-23 · 官方日期 1151023')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '查看個股 →' })).toHaveAttribute(
    'href',
    '/stocks/0050',
  )
  expect(fetchMock.mock.calls[0]).toEqual([
    '/api/v1/research/calendar?',
    expect.objectContaining({ cache: 'no-store' }),
  ])
})

it('preserves calendar criteria in shared URLs and resets pagination only on submit', async () => {
  const router = renderPath(
    '/research/calendar?kind=ex_dividend&q=0050&from_date=2026-10-01&to_date=2026-10-31&page=2',
  )
  await screen.findByRole('heading', { name: event.title })
  expect(screen.getByLabelText('起日')).toHaveValue('2026-10-01')
  expect(screen.getByRole('combobox', { name: '事件類型' })).toHaveValue(
    'ex_dividend',
  )
  fireEvent.change(screen.getByLabelText('迄日'), {
    target: { value: '2026-11-30' },
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fireEvent.submit(screen.getByRole('form', { name: '日曆篩選條件' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  const query = new URLSearchParams(router.state.location.search)
  expect(query.get('to_date')).toBe('2026-11-30')
  expect(query.get('q')).toBe('0050')
  expect(query.has('page')).toBe(false)
})

it('keeps calendar filters while paging', async () => {
  const router = renderPath(
    '/research/calendar?kind=market&from_date=2026-01-01',
  )
  fireEvent.click(await screen.findByRole('link', { name: '下一頁' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  const query = new URLSearchParams(router.state.location.search)
  expect(query.get('kind')).toBe('market')
  expect(query.get('page')).toBe('2')
})

it('computes upcoming dates in Taipei without shifting an all-day calendar date', () => {
  expect(upcomingDates(new Date('2026-10-22T16:30:00Z'))).toEqual({
    from_date: '2026-10-23',
    to_date: '2026-11-21',
  })
})

it('shows partial calendar results but hides download when a selected source failed', async () => {
  fetchMock.mockResolvedValue(
    json({
      ...calendarBody,
      complete: false,
      sources: [
        source('ex-dividend'),
        {
          ...source('market-calendar'),
          status: 'error',
          retrieved_at: null,
          row_count: null,
          error: '來源逾時',
        },
      ],
    }),
  )
  renderPath('/research/calendar')
  expect(await screen.findByRole('alert')).toHaveTextContent('結果不完整')
  expect(screen.getByRole('heading', { name: event.title })).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: '下載完整日期事件 ICS' }),
  ).not.toBeInTheDocument()
  expect(screen.getByText('未取得：來源逾時')).toBeInTheDocument()
})

it('identifies unknown dates instead of inventing a date from retrieval time', async () => {
  fetchMock.mockResolvedValue(
    json({
      ...calendarBody,
      data: [{ ...event, date: null, source_date: '未定' }],
      undated: 1,
    }),
  )
  renderPath('/research/calendar')
  await screen.findByText('日期無法辨識 · 官方日期 未定')
  expect(screen.getByText(/1 筆來源日期無法辨識/)).toBeInTheDocument()
})

it('downloads an ICS snapshot with fresh criteria and reports omitted undated records', async () => {
  const NativeURL = URL
  const createURL = vi.fn().mockReturnValue('blob:calendar')
  vi.stubGlobal(
    'URL',
    class extends NativeURL {
      static createObjectURL = createURL
      static revokeObjectURL = vi.fn()
    },
  )
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  renderPath('/research/calendar?kind=market&from_date=2026-10-23&page=2')
  await screen.findByRole('heading', { name: event.title })
  fetchMock.mockResolvedValue(
    new Response('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n', {
      headers: { 'Content-Type': 'text/calendar', 'X-Skipped-Undated': '1' },
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: '下載完整日期事件 ICS' }))
  await screen.findByText('已下載；1 筆日期不明資料未納入日曆。')
  expect(createURL).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[1]).toEqual([
    '/api/v1/research/calendar/export?kind=market&from_date=2026-10-23&page=2',
    expect.objectContaining({
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    }),
  ])
})

it('rejects failed or incomplete ICS downloads without reporting success', async () => {
  renderPath('/research/calendar')
  await screen.findByRole('heading', { name: event.title })
  fetchMock.mockResolvedValue(
    json({ error: { code: 'SOURCE_INCOMPLETE' } }, 503),
  )
  fireEvent.click(screen.getByRole('button', { name: '下載完整日期事件 ICS' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('無法下載完整日曆')
  expect(
    screen.getByRole('button', { name: '下載完整日期事件 ICS' }),
  ).toBeEnabled()
})

it('shows official risk dates and raw disposition measures without inferring active status', async () => {
  fetchMock.mockResolvedValue(
    json({
      ...riskBody,
      data: [
        {
          ...notice,
          kind: 'disposition',
          description: '115/10/22～115/11/02\n處置措施原文',
          fields: {
            DispositionPeriod: '115/10/22～115/11/02',
            DispositionMeasures: '處置措施原文',
          },
        },
      ],
    }),
  )
  renderPath('/research/risks?code=0050')
  await screen.findByRole('heading', { level: 1, name: '個股風險提示' })
  expect(screen.getByText('處置股票', { selector: '.tag' })).toBeInTheDocument()
  expect(screen.getByText('公告日期：2026-10-22')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '0050 測試ETF' })).toHaveAttribute(
    'href',
    '/stocks/0050',
  )
  expect(
    screen.getByText(/未列出不代表無其他風險或必然可交易/),
  ).toBeInTheDocument()
})

it('submits exact risk codes and source selection on demand', async () => {
  const router = renderPath('/research/risks')
  await screen.findByRole('heading', { name: '0050 測試ETF' })
  fireEvent.change(
    screen.getByRole('textbox', { name: '證券代碼（留空查看全部）' }),
    { target: { value: '0050' } },
  )
  fireEvent.change(screen.getByRole('combobox', { name: '公告類型' }), {
    target: { value: 'suspension' },
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fireEvent.submit(screen.getByRole('form', { name: '風險公告條件' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  expect(new URLSearchParams(router.state.location.search).get('kind')).toBe(
    'suspension',
  )
  expect(fetchMock.mock.calls[1][0]).toContain('code=0050')
})

it('shows an incomplete empty risk lookup without claiming no risk', async () => {
  fetchMock.mockResolvedValue(
    json({
      ...riskBody,
      data: [],
      complete: false,
      pagination: { page: 1, limit: 20, total: 0 },
    }),
  )
  renderPath('/research/risks?code=0050')
  expect(await screen.findByRole('alert')).toHaveTextContent('結果不完整')
  expect(
    screen.getByText('目前成功取得的來源未列出符合公告，查詢尚不完整。'),
  ).toBeInTheDocument()
})

it.each(['/research/calendar', '/research/risks'])(
  'clears old events while refreshing and after a source failure: %s',
  async (path) => {
    renderPath(path)
    await screen.findByRole('heading', { level: 1 })
    let finish: (value: Response) => void = () => {}
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    fireEvent.click(screen.getByRole('button', { name: '重新取得' }))
    await screen.findByRole('button', { name: '正在取得…' })
    expect(
      screen.queryByRole('heading', { name: event.title }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: '0050 測試ETF' }),
    ).not.toBeInTheDocument()
    await act(async () =>
      finish(json({ error: { code: 'SOURCE_UNAVAILABLE' } }, 503)),
    )
    await screen.findByRole('alert')
    expect(screen.queryByLabelText('官方來源取得狀態')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  },
)

it('loads stock risk notices only after an explicit click, then clears them on failure', async () => {
  render(
    <MemoryRouter>
      <StockRiskPanel code="0050" />
    </MemoryRouter>,
  )
  expect(fetchMock).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '取得此股風險公告' }))
  await screen.findByRole('heading', { name: '0050 測試ETF' })
  expect(fetchMock.mock.calls[0][0]).toBe(
    '/api/v1/research/risks?code=0050&limit=100',
  )
  fetchMock.mockResolvedValue(
    json({ error: { code: 'SOURCE_UNAVAILABLE' } }, 503),
  )
  fireEvent.click(screen.getByRole('button', { name: '重新取得風險公告' }))
  await screen.findByRole('alert')
  expect(
    screen.queryByRole('heading', { name: '0050 測試ETF' }),
  ).not.toBeInTheDocument()
})

it('aborts a stock risk lookup when switching stocks and ignores its late response', async () => {
  let finish: (value: Response) => void = () => {}
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
  )
  const view = render(
    <MemoryRouter>
      <StockRiskPanel code="0050" key="0050" />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: '取得此股風險公告' }))
  const signal = fetchMock.mock.calls[0][1].signal as AbortSignal
  view.rerender(
    <MemoryRouter>
      <StockRiskPanel code="2330" key="2330" />
    </MemoryRouter>,
  )
  expect(signal.aborted).toBe(true)
  await act(async () => finish(json(riskBody)))
  expect(screen.queryByText('注意原因原文')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '取得此股風險公告' })).toBeEnabled()
})

it('renders source text safely without interpreting HTML as page content', async () => {
  fetchMock.mockResolvedValue(
    json({
      ...calendarBody,
      data: [
        {
          ...event,
          description: '<img src=x onerror=alert(1)>',
          fields: { Name: '<script>alert(1)</script>' },
        },
      ],
    }),
  )
  renderPath('/research/calendar')
  await screen.findByText('<img src=x onerror=alert(1)>')
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  const details = screen.getByText('官方欄位與原始內容').closest('details')!
  fireEvent.click(within(details).getByText('官方欄位與原始內容'))
  expect(
    within(details).getByText('<script>alert(1)</script>'),
  ).toBeInTheDocument()
})
