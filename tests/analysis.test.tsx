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
import { loadStockAnalysis, type StockAnalysis } from '../src/services/analysis'

const meta = {
  source: 'FinMind' as const,
  dataset: 'TaiwanStockPrice',
  source_url: 'https://api.finmindtrade.com/api/v4/data',
  retrieved_at: '2026-07-31T08:00:00Z',
  query_start: '2026-01-02',
  query_end: '2026-07-31',
  row_count: 65,
  retrieval: 'on_request' as const,
  price_basis: 'unadjusted' as const,
  units: { price: 'TWD', volume: 'share' },
}
const section = <T,>(data: T[]) => ({
  status: 'ok' as const,
  data,
  meta,
  error: null,
})
const fixture: StockAnalysis = {
  code: '0050',
  name: '測試 ETF',
  market: 'TWSE',
  start_date: '2026-07-01',
  end_date: '2026-07-31',
  revenue_start_month: '2023-08',
  complete: true,
  history: section([
    {
      date: '2026-07-01',
      open: '100',
      high: '105',
      low: '99',
      close: '103.2500',
      volume: '12345678901234567890',
      amount: '5555',
      opening_reference: false,
      price_available: true,
      ma20: '101.1250',
      ma60: null,
      rsi14: '55.5000',
      macd: '1.2500',
      macd_signal: '0.7500',
      macd_histogram: '0.5000',
      bollinger_middle: '100.0000',
      bollinger_upper: '110.0000',
      bollinger_lower: '90.0000',
    },
  ]),
  revenue: section([
    {
      month: '2026-05',
      revenue: '25000000000',
      yoy: '150.0000',
      mom: null,
      record_date: '2026-06-01',
      recorded_at: null,
      ytd_revenue: '120000000000',
      ytd_yoy: '12.5000',
      trailing12_revenue: '240000000000',
      trailing12_yoy: '8.0000',
    },
  ]),
  institutions: section([
    {
      date: '2026-07-01',
      trades: [
        {
          name: 'Foreign_Investor',
          label: '外資（不含外資自營）',
          buy: '150',
          sell: '50',
          net: '100',
          net5: '500',
          net20: null,
        },
        {
          name: 'Dealer_Hedging',
          label: '自營商避險',
          buy: '0',
          sell: '30',
          net: '-30',
          net5: '-150',
          net20: null,
        },
      ],
    },
  ]),
}
const page = '/stocks/0050/history?start_date=2026-07-01&end_date=2026-07-31'
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const fetchMock = vi.fn()
const routers: ReturnType<typeof createMemoryRouter>[] = []
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(json(fixture))
  vi.stubGlobal('fetch', (path: string, ...args: unknown[]) =>
    path === '/api/v1/me'
      ? Promise.resolve(json({ error: { code: 'SESSION_INVALID' } }, 401))
      : fetchMock(path, ...args),
  )
})
afterEach(() => {
  cleanup()
  routers.splice(0).forEach((r) => r.dispose())
  vi.unstubAllGlobals()
})
function renderPage(path = page) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  routers.push(router)
  render(<RouterProvider router={router} />)
  return router
}

it('uses one same-origin no-store research request and renders all three sections', async () => {
  renderPage()
  await screen.findByRole('heading', { name: '測試 ETF · 歷史研究' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/stocks/0050/analysis?start_date=2026-07-01&end_date=2026-07-31',
    expect.objectContaining({ cache: 'no-store' }),
  )
  expect(
    screen.getByRole('img', { name: /日 K、MA20、MA60/ }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: '月營收與成長率' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: '法人買賣超' }),
  ).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'FinMind' })).toHaveLength(3)
  expect(screen.getByRole('link', { name: '← 返回個股摘要' })).toHaveAttribute(
    'href',
    '/stocks/0050',
  )
})

it('keeps exact numbers, missing values, business months and separate collection dates', async () => {
  renderPage()
  await screen.findByRole('heading', { name: '測試 ETF · 歷史研究' })
  fireEvent.click(screen.getByText('查看日線與均線明細'))
  expect(screen.getByText('12345678901234567890')).toBeInTheDocument()
  expect(screen.getByText('103.2500')).toBeInTheDocument()
  expect(screen.getByText('101.1250')).toBeInTheDocument()
  fireEvent.click(screen.getByText('查看月營收明細'))
  const table = screen.getByRole('table', { name: /月營收單位/ })
  expect(within(table).getByText('2026-05')).toBeInTheDocument()
  expect(within(table).getByText('2026-06-01')).toBeInTheDocument()
  expect(within(table).getByText('150.0000')).toBeInTheDocument()
  expect(within(table).getAllByText('—')).toHaveLength(2)
})

it('switches institutional categories locally without extra requests or combining them', async () => {
  renderPage()
  await screen.findByRole('heading', { name: '測試 ETF · 歷史研究' })
  fireEvent.change(screen.getByLabelText('法人分類'), {
    target: { value: 'Dealer_Hedging' },
  })
  expect(
    screen.getByRole('img', { name: '自營商避險每日買賣超' }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByText('查看法人買賣明細'))
  expect(
    within(screen.getByRole('table', { name: /自營商避險/ })).getByText('-30'),
  ).toBeInTheDocument()
  expect(screen.getByText('-150')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('isolates a failed section while preserving this request’s successful data', async () => {
  const result = structuredClone(fixture)
  result.complete = false
  result.history = {
    status: 'error',
    data: null,
    meta: null,
    error: {
      code: 'FINMIND_DATA_INVALID',
      message: 'FinMind 回應的資料格式無法辨識。',
    },
  }
  fetchMock.mockResolvedValue(json(result))
  renderPage()
  await screen.findByText('FinMind 回應的資料格式無法辨識。')
  expect(screen.getByRole('img', { name: '每月營收' })).toBeInTheDocument()
  expect(
    screen.queryByRole('img', { name: /日 K、MA20/ }),
  ).not.toBeInTheDocument()
  expect(screen.getAllByRole('alert')).toHaveLength(2)
})

it('clears old charts during refresh and does not resurrect them after failure', async () => {
  renderPage()
  await screen.findByRole('img', { name: /日 K、MA20/ })
  let release!: (r: Response) => void
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        release = resolve
      }),
  )
  fireEvent.click(screen.getByRole('button', { name: '重新取得' }))
  await screen.findByRole('status')
  expect(
    screen.queryByRole('img', { name: /日 K、MA20/ }),
  ).not.toBeInTheDocument()
  await act(async () =>
    release(json({ error: { code: 'FINMIND_UNAVAILABLE' } }, 503)),
  )
  await screen.findByRole('heading', { name: '研究資料無法取得' })
  expect(screen.getByRole('alert')).toHaveTextContent('FinMind')
  expect(screen.queryByText('103.2500')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('submits dates as URL filters and requests fresh data', async () => {
  const router = renderPage()
  await screen.findByRole('heading', { name: '測試 ETF · 歷史研究' })
  fireEvent.change(screen.getByLabelText('日線與法人開始日期'), {
    target: { value: '2026-06-01' },
  })
  fireEvent.submit(
    screen.getByRole('button', { name: '查詢研究資料' }).closest('form')!,
  )
  await waitFor(() =>
    expect(router.state.location.search).toContain('start_date=2026-06-01'),
  )
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
})

it('distinguishes successful empty data and unrequested sections', async () => {
  const result = structuredClone(fixture)
  result.complete = false
  result.history = section([])
  result.revenue = {
    status: 'not_requested',
    data: null,
    meta: null,
    error: { code: 'FINMIND_RATE_LIMITED', message: 'FinMind 額度已達上限。' },
  }
  fetchMock.mockResolvedValue(json(result))
  renderPage()
  await screen.findByText('來源在此查詢期間未提供資料。')
  expect(
    screen.getByText('來源存取受限，本次未繼續查詢此區塊。'),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('img', { name: /日 K、MA20/ }),
  ).not.toBeInTheDocument()
})

it('cancels navigation and never retries or calls FinMind directly from the browser', async () => {
  const abort = new AbortController()
  fetchMock.mockImplementation(async (_path: string, options: RequestInit) => {
    abort.abort()
    options.signal?.throwIfAborted()
    return json(fixture)
  })
  await expect(
    loadStockAnalysis({
      params: { code: '0050' },
      request: new Request(`http://localhost${page}`, { signal: abort.signal }),
    }),
  ).rejects.toThrow()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][0]).toMatch(/^\/api\/v1\//)
})

it('rejects invalid codes without fetching', async () => {
  const result = await loadStockAnalysis({
    params: { code: 'invalid-code' },
    request: new Request(`http://localhost${page}`),
  })
  expect(result.error).toContain('有效的上市證券代碼')
  expect(fetchMock).not.toHaveBeenCalled()
})

it('switches Bollinger, RSI, MACD and revenue views locally and keeps exact indicator values', async () => {
  renderPage()
  await screen.findByRole('img', { name: 'RSI（14）' })
  fireEvent.change(screen.getByLabelText('主圖指標'), {
    target: { value: 'bollinger' },
  })
  expect(
    screen.getByRole('img', { name: /日 K、布林通道/ }),
  ).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('副圖指標'), {
    target: { value: 'macd' },
  })
  expect(
    screen.getByRole('img', { name: 'MACD（12，26，9）' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('img', { name: 'RSI（14）' }),
  ).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('營收圖表'), {
    target: { value: 'trailing12_revenue' },
  })
  expect(
    screen.getByRole('img', { name: '近 12 個月營收' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('img', { name: '每月營收' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByText('最新營收月份：2026-05；累計比較均截至該月份。'),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByText('查看日線與均線明細'))
  const history = screen.getByRole('table', { name: /原始股價/ })
  expect(within(history).getByText('55.5000')).toBeInTheDocument()
  expect(within(history).getByText('0.5000')).toBeInTheDocument()
  fireEvent.click(screen.getByText('查看月營收明細'))
  expect(
    within(screen.getByRole('table', { name: /月營收單位/ })).getByText(
      '120000000000',
    ),
  ).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('shows missing prices, indicator warmup and incomplete revenue without zero-price candles', async () => {
  const result = structuredClone(fixture)
  Object.assign(result.history.data![0], {
    price_available: false,
    open: '0',
    high: '0',
    low: '0',
    close: '0',
    ma20: null,
    ma60: null,
    rsi14: null,
    macd: null,
    macd_signal: null,
    macd_histogram: null,
    bollinger_middle: null,
    bollinger_upper: null,
    bollinger_lower: null,
  })
  Object.assign(result.revenue.data![0], {
    ytd_revenue: null,
    ytd_yoy: null,
    trailing12_revenue: null,
    trailing12_yoy: null,
  })
  fetchMock.mockResolvedValue(json(result))
  renderPage()
  await screen.findByText('RSI（14） 尚無足夠有效收盤價可供計算。')
  const candle = screen.getByRole('img', { name: /日 K、MA20、MA60/ })
  expect(candle).toHaveTextContent('本期間無公告成交價，僅顯示成交量。')
  expect(candle.querySelectorAll('rect')).toHaveLength(1)
  expect(candle.querySelector('path')?.getAttribute('d')).toBe('')
  fireEvent.click(screen.getByText('查看日線與均線明細'))
  expect(
    within(screen.getByRole('table', { name: /原始股價/ })).queryByText('0'),
  ).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('營收圖表'), {
    target: { value: 'ytd_revenue' },
  })
  expect(
    screen.getByText('此營收指標所需月份尚不完整，暫無可繪製資料。'),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('img', { name: '年初至當月累計營收' }),
  ).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
