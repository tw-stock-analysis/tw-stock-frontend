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
import { loadComparison } from '../src/services/research'

const stock = {
  code: '0050',
  name: '測試ETF',
  date: '1151022',
  opening_price: null,
  highest_price: null,
  lowest_price: null,
  closing_price: '123.4500',
  change: '-1.5',
  change_percent: '-1.2000',
  trade_volume: '9007199254740993',
  trade_value: null,
  transactions: null,
}
const otherStock = {
  ...stock,
  code: '2330',
  name: '測試股票',
  change_percent: '2.0000',
}
const meta = {
  source: 'TWSE',
  source_url: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
  retrieved_at: '2026-10-23T03:00:00Z',
  data_date: '1151022',
  retrieval: 'on_request',
  units: 'source_native',
  note: '日成交快照，非盤中報價。',
}
const screenBody = {
  data: [stock, otherStock],
  pagination: { page: 1, limit: 20, total: 25 },
  meta,
  calculation: '漲跌幅 = 漲跌價差 ÷（收盤價 − 漲跌價差）× 100。',
}
const comparisonBody = {
  data: [
    { code: '0050', quote: stock, valuation: null },
    {
      code: '2330',
      quote: otherStock,
      valuation: {
        code: '2330',
        name: '測試股票',
        date: '1151021',
        pe_ratio: '22.2200',
        pb_ratio: '0',
        dividend_yield: null,
      },
    },
  ],
  quote_meta: meta,
  valuation_meta: { ...meta, data_date: '1151021' },
  valuation_error: null,
}
const overviewBody = {
  total: 4,
  rising: 1,
  declining: 1,
  unchanged: 1,
  unclassified: 1,
  excluded: 2,
  gainers: [otherStock],
  losers: [stock],
  volume_leaders: [stock, otherStock],
  meta,
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const fetchMock = vi.fn()
const routers: ReturnType<typeof createMemoryRouter>[] = []
beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async (path: string) => {
    if (path.startsWith('/api/v1/research/screener/export'))
      return new Response("\ufeff證券代碼,名稱\r\n'0050,測試ETF\r\n", {
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    if (path.startsWith('/api/v1/research/screener')) return json(screenBody)
    if (path.startsWith('/api/v1/research/compare')) return json(comparisonBody)
    if (path === '/api/v1/research/overview') return json(overviewBody)
    return json({}, 404)
  })
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

it('opens research tools from navigation and preserves leading zero identifiers and exact values', async () => {
  renderPath('/research')
  await screen.findByRole('table')
  expect(
    screen.getByRole('heading', { name: '選股篩選器', level: 1 }),
  ).toBeInTheDocument()
  expect(
    within(screen.getByRole('navigation', { name: '主要導覽' })).getByRole(
      'link',
      { name: '研究工具' },
    ),
  ).toHaveAttribute('aria-current', 'page')
  expect(screen.getAllByText('9007199254740993')).toHaveLength(2)
  expect(screen.getByRole('link', { name: /測試ETF/ })).toHaveAttribute(
    'href',
    '/stocks/0050',
  )
  expect(screen.getByText('-1.2000%')).toHaveClass('fall')
  expect(screen.getByText('+2.0000%')).toHaveClass('rise')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('submits filters explicitly, resets pagination and restores conditions from a shared URL', async () => {
  const router = renderPath(
    '/research/screener?min_price=50&max_price=200&page=2&sort=trade_volume&order=desc',
  )
  await screen.findByRole('table')
  expect(
    screen.getByRole('spinbutton', { name: '最低股價（元）' }),
  ).toHaveValue(50)
  expect(screen.getByRole('combobox', { name: '排序方向' })).toHaveValue('desc')
  fireEvent.change(screen.getByRole('spinbutton', { name: '最低股價（元）' }), {
    target: { value: '60' },
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fireEvent.submit(screen.getByRole('form', { name: '選股條件' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  const query = new URLSearchParams(router.state.location.search)
  expect(query.get('min_price')).toBe('60')
  expect(query.has('page')).toBe(false)
  expect(fetchMock.mock.calls[1][0]).not.toContain('min_change=')
})

it('keeps filters and sorting when paging and fetches fresh source data', async () => {
  const router = renderPath(
    '/research/screener?q=測試&min_volume=100&sort=trade_volume&order=desc',
  )
  fireEvent.click(await screen.findByRole('link', { name: '下一頁' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  const query = new URLSearchParams(router.state.location.search)
  expect(query.get('q')).toBe('測試')
  expect(query.get('min_volume')).toBe('100')
  expect(query.get('page')).toBe('2')
  expect(query.get('order')).toBe('desc')
})

it('compares checked stocks and only submits two to four unique codes', async () => {
  renderPath('/research/screener')
  await screen.findByRole('table')
  expect(
    screen.queryByRole('link', { name: '比較所選證券' }),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('checkbox', { name: '比較 0050 測試ETF' }))
  fireEvent.click(screen.getByRole('checkbox', { name: '比較 2330 測試股票' }))
  fireEvent.click(screen.getByRole('link', { name: '比較所選證券' }))
  await screen.findByRole('heading', { name: '股票比較', level: 1 })
  expect(fetchMock.mock.calls[1][0]).toBe(
    '/api/v1/research/compare?codes=0050%2C2330',
  )
  expect(screen.getByText('22.2200')).toBeInTheDocument()
  expect(screen.getAllByText('1151021').length).toBeGreaterThan(0)
  expect(screen.getAllByText('1151022').length).toBeGreaterThan(0)
})

it('starts with instructions without fetching when no comparison codes have been chosen', async () => {
  renderPath('/research/compare')
  await screen.findByRole('heading', { name: '股票比較', level: 1 })
  expect(screen.getByText(/輸入證券代碼開始比較/)).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each(['0050', '0050,0050', '0050,2330,2317,8888,9999', '0050,invalid'])(
  'rejects invalid comparison input %s without requesting data',
  async (codes) => {
    renderPath(`/research/compare?${new URLSearchParams({ codes })}`)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '2～4 個不同的證券代碼',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  },
)

it('accepts comma, full-width comma and whitespace separated codes without losing zeros', async () => {
  await loadComparison({
    request: new Request('http://localhost/research/compare?codes=0050，2330'),
  })
  expect(fetchMock.mock.calls[0][0]).toBe(
    '/api/v1/research/compare?codes=0050%2C2330',
  )
})

it('renders partial valuation failures separately while unknown stocks remain identifiable', async () => {
  fetchMock.mockResolvedValue(
    json({
      ...comparisonBody,
      data: [
        comparisonBody.data[0],
        { code: '9999', quote: null, valuation: null },
      ],
      valuation_meta: null,
      valuation_error: 'TWSE 暫時限制請求。',
    }),
  )
  renderPath('/research/compare?codes=0050,9999')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '估值資料暫時無法取得',
  )
  expect(screen.getByText('123.4500')).toBeInTheDocument()
  expect(screen.getByText('本次日成交資料找不到此代碼')).toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: '估值資料來源' }),
  ).not.toBeInTheDocument()
})

it('shows breadth counts and latest-date rankings with explicit coverage', async () => {
  renderPath('/research/overview')
  await screen.findByRole('heading', { name: '市場總覽', level: 1 })
  expect(screen.getAllByRole('table')).toHaveLength(3)
  expect(
    screen.getByText(/排除其他日期或日期不明的資料 2 檔/),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('region', { name: '漲幅前 10 名' }),
  ).toHaveTextContent('測試股票')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('distinguishes a valid empty market response from source failure', async () => {
  fetchMock.mockResolvedValue(
    json({
      ...overviewBody,
      total: 0,
      rising: 0,
      declining: 0,
      unchanged: 0,
      unclassified: 0,
      excluded: 0,
      gainers: [],
      losers: [],
      volume_leaders: [],
    }),
  )
  renderPath('/research/overview')
  await screen.findByText('本次沒有可統計的有效交易日資料。')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

it.each([
  '/research/screener',
  '/research/compare?codes=0050,2330',
  '/research/overview',
])(
  'hides old results while refreshing and removes them after failure: %s',
  async (path) => {
    renderPath(path)
    await screen.findAllByRole('table')
    let finish: (value: Response) => void = () => {}
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    fireEvent.click(screen.getByRole('button', { name: '重新取得' }))
    await screen.findByRole('button', { name: '正在取得…' })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await act(async () =>
      finish(json({ error: { code: 'SOURCE_UNAVAILABLE' } }, 503)),
    )
    await screen.findByRole('alert')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('123.4500')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  },
)

it('exports all filtered results with the same conditions and a fresh no-store request', async () => {
  const createURL = vi.fn().mockReturnValue('blob:test')
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createURL,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {})
  renderPath(
    '/research/screener?min_price=20&page=2&sort=trade_volume&order=desc',
  )
  fireEvent.click(
    await screen.findByRole('button', { name: '匯出全部結果 CSV' }),
  )
  await waitFor(() => expect(createURL).toHaveBeenCalled())
  expect(fetchMock.mock.calls[1]).toEqual([
    '/api/v1/research/screener/export?min_price=20&page=2&sort=trade_volume&order=desc',
    expect.objectContaining({
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    }),
  ])
  expect(click).toHaveBeenCalledTimes(1)
})

it('reports a failed export without triggering a download', async () => {
  renderPath('/research/screener')
  await screen.findByRole('table')
  fetchMock.mockResolvedValue(
    json({ error: { code: 'SOURCE_UNAVAILABLE' } }, 503),
  )
  fireEvent.click(screen.getByRole('button', { name: '匯出全部結果 CSV' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('無法匯出本次資料')
  expect(screen.getByRole('button', { name: '匯出全部結果 CSV' })).toBeEnabled()
})
