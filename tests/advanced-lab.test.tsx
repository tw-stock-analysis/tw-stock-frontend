// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { routes } from '../src/app/routes'
import {
  defaultPortfolioQuery,
  portfolioPayload,
  safeSourceURL,
  type MarketScreenResult,
  type SecurityView,
} from '../src/services/advancedLab'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const fetchMock = vi.fn()
const routers: ReturnType<typeof createMemoryRouter>[] = []
const screenFixture: MarketScreenResult = {
  rows: [
    {
      market: 'TWSE',
      code: '2330',
      name: '測試甲',
      status: 'ok',
      matches: true,
      metrics: {
        revenue_yoy: '20',
        gross_margin: '40',
        operating_margin: '30',
        debt_ratio: '20',
      },
      dates: { revenue: '2026-09' },
      error: null,
    },
  ],
  pagination: { page: 1, limit: 20, total: 21 },
  coverage: {
    universe: 100,
    matched: 21,
    not_matched: 70,
    insufficient: 8,
    errors: 1,
    complete: false,
  },
  sources: [],
  notes: ['僅本次快照，不推定歷史公告資訊。'],
}
const id = '11111111-1111-4111-8111-111111111111'
const evidence = {
  source_name: '官方查證資料',
  source_url: 'https://example.test/evidence',
  observed_on: '2026-11-01',
  effective_date: '2020-01-02',
}
const security: SecurityView = {
  id,
  registry_key: 'test:one',
  name: '測試公司',
  instrument_type: 'ordinary_share',
  issuer_ubn: '12345678',
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
  listings: [
    {
      id: 'listing-one',
      market: 'TPEX',
      code: '1234',
      name: '舊名',
      valid_from: '2020-01-02',
      valid_to: '2023-01-02',
      start_evidence: evidence,
      end_evidence: { ...evidence, effective_date: '2023-01-02' },
    },
    {
      id: 'listing-two',
      market: 'TWSE',
      code: '1234',
      name: '新名',
      valid_from: '2023-01-02',
      valid_to: null,
      start_evidence: { ...evidence, effective_date: '2023-01-02' },
      end_evidence: null,
    },
  ],
  identifiers: [],
  market_at_as_of: {
    status: 'verified',
    as_of: '2021-01-04',
    market: 'TPEX',
    code: '1234',
    security_id: id,
    reason: '該日期有已查證的上櫃掛牌期間。',
  },
  note: '未列出的期間不推定身分。',
}
beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async (path: string) => {
    if (path === '/api/v1/me')
      return json({ error: { code: 'SESSION_INVALID' } }, 401)
    throw new Error('Unexpected request ' + path)
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  routers.splice(0).forEach((router) => router.dispose())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  routers.push(router)
  render(<RouterProvider router={router} />)
  return router
}
function intercept(
  path: string,
  reply: (init: RequestInit) => Promise<Response>,
) {
  const previous = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((url: string, init: RequestInit) =>
    url === path ? reply(init) : previous(url, init),
  )
}
function submit(label: string) {
  fireEvent.submit(screen.getByRole('button', { name: label }).closest('form')!)
}

it('only queries the whole market on submission and explains paid access without falling back to per-stock requests', async () => {
  intercept('/api/v1/research/market-screen', async () =>
    json(
      { error: { code: 'FINMIND_ACCESS_DENIED', message: '來源權限不足' } },
      503,
    ),
  )
  open('/research/market-screen')
  await screen.findByRole('heading', { name: '全市場基本面掃描' })
  fireEvent.change(screen.getByLabelText('毛利率下限（%）'), {
    target: { value: '20' },
  })
  expect(
    fetchMock.mock.calls.some(([path]) =>
      String(path).includes('market-screen'),
    ),
  ).toBe(false)
  submit('執行全市場掃描')
  await screen.findByRole('alert')
  expect(screen.getByRole('alert')).toHaveTextContent('相應方案權限')
  expect(
    fetchMock.mock.calls.filter(([path]) =>
      String(path).includes('market-screen'),
    ),
  ).toHaveLength(1)
  expect(
    fetchMock.mock.calls.some(
      ([path]) =>
        String(path).includes('/stocks/') ||
        String(path).includes('/instruments/'),
    ),
  ).toBe(false)
  const [, options] = fetchMock.mock.calls.find(([path]) =>
    String(path).includes('market-screen'),
  )!
  expect(options.cache).toBe('no-store')
  expect(JSON.parse(options.body)).toMatchObject({
    result_filter: 'matched',
    rules: { min_gross_margin: '20' },
    page: 1,
  })
})
it('reports whole-universe coverage and reuses submitted filters for explicitly requested pages', async () => {
  intercept('/api/v1/research/market-screen', async (init) => {
    const query = JSON.parse(String(init.body))
    return json({
      ...screenFixture,
      pagination: { page: query.page, limit: query.limit, total: 101 },
    })
  })
  open('/research/market-screen')
  await screen.findByRole('heading', { name: '全市場基本面掃描' })
  submit('執行全市場掃描')
  await screen.findByRole('heading', { name: '本次全市場掃描結果' })
  expect(screen.getByRole('alert')).toHaveTextContent('部分候選資料不足')
  expect(screen.getByRole('cell', { name: '符合' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('毛利率下限（%）'), {
    target: { value: '99' },
  })
  fireEvent.click(screen.getByRole('button', { name: '下一頁' }))
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.filter(([path]) =>
        String(path).includes('market-screen'),
      ),
    ).toHaveLength(2),
  )
  const calls = fetchMock.mock.calls.filter(([path]) =>
    String(path).includes('market-screen'),
  )
  expect(JSON.parse(calls[1][1].body)).toMatchObject({
    page: 2,
    rules: { min_revenue_yoy: '0' },
  })
  expect(JSON.parse(calls[1][1].body).rules.min_gross_margin).toBeUndefined()
})
it('clears old scanning results while loading and ignores a cancelled response', async () => {
  let resolve: ((value: Response) => void) | undefined
  let call = 0,
    signal: AbortSignal | undefined
  intercept('/api/v1/research/market-screen', async (init) => {
    call++
    if (call === 1) return json(screenFixture)
    signal = init.signal as AbortSignal
    return new Promise<Response>((done) => {
      resolve = done
    })
  })
  open('/research/market-screen')
  await screen.findByRole('heading', { name: '全市場基本面掃描' })
  submit('執行全市場掃描')
  await screen.findByRole('heading', { name: '本次全市場掃描結果' })
  submit('執行全市場掃描')
  await screen.findByRole('button', { name: '取消本次掃描' })
  expect(
    screen.queryByRole('heading', { name: '本次全市場掃描結果' }),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '取消本次掃描' }))
  expect(signal?.aborted).toBe(true)
  await act(async () => {
    resolve?.(json(screenFixture))
    await Promise.resolve()
  })
  expect(
    screen.queryByRole('heading', { name: '本次全市場掃描結果' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('已取消本次掃描')
})
it('validates portfolio allocations and removes fixed weights from price factor requests', () => {
  const query = defaultPortfolioQuery()
  expect(query.allow_unverified_identity).toBe(false)
  expect(() =>
    portfolioPayload({
      ...query,
      assets: [
        { market: 'TWSE', code: '2330', weight: '0.8' },
        { market: 'TWSE', code: '2317', weight: '0.8' },
      ],
    }),
  ).toThrow('總和')
  expect(() =>
    portfolioPayload({
      ...query,
      assets: [
        { market: 'TWSE', code: '2330', weight: '0.5' },
        { market: 'TPEX', code: '2330', weight: '0.5' },
      ],
    }),
  ).toThrow('代碼不得重複')
  const fixed = portfolioPayload({ ...query, lookback: 0, top_n: 20 })
  expect(fixed).toMatchObject({ lookback: 60, top_n: 2 })
  const payload = portfolioPayload({ ...query, strategy: 'momentum' })
  expect(payload.assets).toEqual([
    { market: 'TWSE', code: '2330' },
    { market: 'TWSE', code: '2317' },
  ])
})
it('submits factor backtests with explicit universe, strict identity and prior-date result details', async () => {
  intercept('/api/v1/research/portfolio-backtest', async (init) =>
    json({
      parameters: JSON.parse(String(init.body)),
      assets: [],
      sources: [],
      orders: [],
      equity: [
        {
          date: '2026-11-03',
          equity: '1000000',
          cash: '1000000',
          positions: [],
        },
      ],
      rebalances: [
        {
          signal_date: '2026-10-30',
          execution_date: '2026-11-02',
          weights: { 'TWSE:2330': '0.5', 'TWSE:2317': '0.5' },
          scores: { 'TWSE:2330': '0.2', 'TWSE:2317': '0.1' },
        },
      ],
      summary: {
        final_equity: '1000000',
        return_percent: '0',
        max_drawdown_percent: '0',
        fees_and_taxes: '0',
        turnover: '0',
      },
      notes: ['因子僅採用成交前可取得的收盤資料。'],
    }),
  )
  open('/research/portfolio-backtest')
  await screen.findByRole('heading', { name: '跨股因子與再平衡回測' })
  fireEvent.change(screen.getByLabelText('回測方式'), {
    target: { value: 'momentum' },
  })
  expect(screen.queryByLabelText('第 1 檔目標權重')).not.toBeInTheDocument()
  submit('執行組合回測')
  await screen.findByRole('heading', { name: '本次組合回測結果' })
  const [, options] = fetchMock.mock.calls.find(([path]) =>
    String(path).includes('portfolio-backtest'),
  )!
  expect(JSON.parse(options.body)).toMatchObject({
    strategy: 'momentum',
    allow_unverified_identity: false,
    assets: [
      { market: 'TWSE', code: '2330' },
      { market: 'TWSE', code: '2317' },
    ],
  })
  expect(screen.getByText('2026-10-30')).toBeInTheDocument()
  expect(screen.getByText('2026-11-02')).toBeInTheDocument()
})
it('does not fetch an unfiltered identity registry and opens stable IDs from dated search results', async () => {
  const previous = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((path: string, init: RequestInit) =>
    path.startsWith('/api/v1/securities?')
      ? Promise.resolve(
          json({
            data: [security],
            pagination: { page: 1, limit: 20, total: 1 },
          }),
        )
      : previous(path, init),
  )
  open('/research/security-identity')
  await screen.findByRole('heading', { name: '歷史證券身分與市場時間軸' })
  expect(
    fetchMock.mock.calls.some(([path]) => String(path).includes('/securities')),
  ).toBe(false)
  fireEvent.change(screen.getByLabelText('身分搜尋證券代碼'), {
    target: { value: '1234' },
  })
  fireEvent.change(screen.getByLabelText('身分查詢日期'), {
    target: { value: '2021-01-04' },
  })
  submit('查詢歷史身分')
  await screen.findByRole('heading', { name: '符合的永久證券身分' })
  const identityCall = fetchMock.mock.calls.find(([path]) =>
    String(path).startsWith('/api/v1/securities?'),
  )!
  expect(
    new URL('http://test' + identityCall[0]).searchParams.get(
      'include_inactive',
    ),
  ).toBe('true')
  expect(screen.getByRole('link', { name: '測試公司' })).toHaveAttribute(
    'href',
    `/research/security-identity/${id}?as_of=2021-01-04`,
  )
})
it('shows verified historical market intervals with evidence and keeps unknown dates explicit', async () => {
  const previous = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((path: string, init: RequestInit) =>
    path.startsWith(`/api/v1/securities/${id}`)
      ? Promise.resolve(
          json({
            ...security,
            market_at_as_of: {
              ...security.market_at_as_of,
              status: 'unknown',
              market: null,
              code: null,
              reason: '這段歷史尚無足夠證據。',
            },
          }),
        )
      : previous(path, init),
  )
  open(`/research/security-identity/${id}?as_of=2021-01-04`)
  await screen.findByRole('heading', { name: '測試公司 · 證券身分' })
  expect(screen.getByRole('note')).toHaveTextContent('資料不足，無法確認')
  expect(screen.getByRole('note')).toHaveTextContent('這段歷史尚無足夠證據')
  expect(
    screen.getByRole('list', { name: '證券市場時間軸' }),
  ).toHaveTextContent('2020-01-02 → 2023-01-02')
  expect(
    screen.getAllByRole('link', { name: '官方查證資料' })[0],
  ).toHaveAttribute('href', 'https://example.test/evidence')
  expect(
    screen.queryByRole('link', { name: /開啟來源研究/ }),
  ).not.toBeInTheDocument()
  expect(safeSourceURL('javascript:alert(1)')).toBeUndefined()
})
it('rejects malformed permanent IDs before making a registry request', async () => {
  open('/research/security-identity/not-a-uuid')
  await screen.findByRole('alert')
  expect(screen.getByRole('alert')).toHaveTextContent('永久識別碼格式不正確')
  expect(
    fetchMock.mock.calls.some(([path]) => String(path).includes('/securities')),
  ).toBe(false)
})

it('preserves the historical as-of date when opening source research from a verified identity', async () => {
  const previous = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((path: string, init: RequestInit) =>
    path.startsWith(`/api/v1/securities/${id}`)
      ? Promise.resolve(json(security))
      : previous(path, init),
  )
  open(`/research/security-identity/${id}?as_of=2021-01-04`)
  await screen.findByRole('heading', { name: '測試公司 · 證券身分' })
  expect(
    screen.getByRole('link', { name: '上櫃 1234 · 開啟來源研究' }),
  ).toHaveAttribute('href', '/instruments/TPEX/1234?end_date=2021-01-04')
})
