import type { AnalysisMeta } from './analysis'
import { taipeiDate } from './analysis'
import type { InstrumentRef, Market } from './lab'

export const financialMetrics = {
  revenue_yoy: '月營收年增率（%）',
  gross_margin: '毛利率（%）',
  operating_margin: '營業利益率（%）',
  debt_ratio: '負債比（%）',
} as const
export const financialRules = {
  min_revenue_yoy: '月營收年增率下限（%）',
  min_gross_margin: '毛利率下限（%）',
  min_operating_margin: '營業利益率下限（%）',
  max_debt_ratio: '負債比上限（%）',
} as const
export type FinancialMetric = keyof typeof financialMetrics
export type FinancialRule = keyof typeof financialRules
export type TradingMarket = Exclude<Market, 'DELISTED'>
export interface MarketScreenQuery {
  markets: TradingMarket[]
  revenue_month: string
  report_date: string
  rules: Partial<Record<FinancialRule, string>>
  sort: 'code' | FinancialMetric
  descending: boolean
  result_filter: 'matched' | 'all' | 'insufficient'
  page: number
  limit: number
}
export interface MarketScreenResult {
  rows: (InstrumentRef & {
    name: string | null
    status: 'ok' | 'insufficient' | 'error'
    matches: boolean | null
    metrics: Record<FinancialMetric, string | null>
    dates: Record<string, string | null>
    error: { code: string; message: string } | null
  })[]
  pagination: { page: number; limit: number; total: number }
  coverage: {
    universe: number
    matched: number
    not_matched: number
    insufficient: number
    errors: number
    complete: boolean
  }
  sources: AnalysisMeta[]
  notes: string[]
}
export type PortfolioStrategy = 'fixed_weights' | 'momentum' | 'low_volatility'
export interface BacktestAsset extends InstrumentRef {
  weight?: string
}
export interface PortfolioBacktestQuery {
  assets: BacktestAsset[]
  strategy: PortfolioStrategy
  rebalance: 'monthly' | 'quarterly'
  lookback: number
  top_n: number
  basis: 'unadjusted' | 'source_adjusted'
  start_date: string
  end_date: string
  initial_cash: string
  commission_rate: string
  sell_tax_rate: string
  slippage_rate: string
  minimum_fee: string
  lot_size: 1 | 1000
  allow_unverified_identity: boolean
}
export interface PortfolioBacktestResult {
  parameters: PortfolioBacktestQuery
  assets: (InstrumentRef & { name?: string; weight?: string | null })[]
  sources: AnalysisMeta[]
  orders: (InstrumentRef & {
    date: string
    side: 'buy' | 'sell'
    quantity: string
    price: string
    fee: string
    tax: string
  })[]
  equity: {
    date: string
    equity: string
    cash: string
    positions: (InstrumentRef & {
      quantity: string
      close: string
      market_value: string
    })[]
  }[]
  rebalances: {
    signal_date: string
    execution_date: string
    weights: Record<string, string>
    scores: Record<string, string | null>
  }[]
  summary: {
    final_equity: string
    return_percent: string
    max_drawdown_percent: string
    fees_and_taxes: string
    turnover: string
    turnover_percent?: string
  }
  notes: string[]
}
export interface IdentityEvidence {
  source_name: string
  source_url: string
  observed_on: string
  effective_date: string
}
export interface SecurityView {
  id: string
  registry_key: string
  name: string
  instrument_type: 'ordinary_share' | 'etf' | 'other'
  issuer_ubn: string | null
  created_at: string
  updated_at: string
  listings: {
    id: string
    market: TradingMarket
    code: string
    name: string
    valid_from: string
    valid_to: string | null
    start_evidence: IdentityEvidence
    end_evidence: IdentityEvidence | null
  }[]
  identifiers: {
    id: string
    kind: 'isin' | 'name'
    value: string
    valid_from: string
    valid_to: string | null
    evidence: IdentityEvidence
    end_evidence?: IdentityEvidence | null
  }[]
  market_at_as_of: {
    status: 'verified' | 'unknown' | 'ambiguous'
    as_of: string
    market: TradingMarket | null
    code: string | null
    security_id: string | null
    reason: string
  }
  note: string
}
export interface SecuritySearchResult {
  data: SecurityView[]
  pagination: { page: number; limit: number; total: number }
}

export function defaultMarketScreen(): MarketScreenQuery {
  const [year, month] = taipeiDate().split('-').map(Number)
  return {
    markets: ['TWSE', 'TPEX'],
    revenue_month: new Date(Date.UTC(year, month - 2, 1))
      .toISOString()
      .slice(0, 10),
    report_date: new Date(Date.UTC(year, Math.floor((month - 1) / 3) * 3, 0))
      .toISOString()
      .slice(0, 10),
    rules: { min_revenue_yoy: '0' },
    sort: 'code',
    descending: false,
    result_filter: 'matched',
    page: 1,
    limit: 50,
  }
}
export function weekdayDate(value: string): string {
  const day = new Date(value + 'T00:00:00Z')
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6)
    day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}
export function defaultPortfolioQuery(): PortfolioBacktestQuery {
  const end = weekdayDate(
    new Date(Date.parse(taipeiDate() + 'T00:00:00Z') - 86400000)
      .toISOString()
      .slice(0, 10),
  )
  const start = weekdayDate(
    new Date(Date.parse(end + 'T00:00:00Z') - 365 * 86400000)
      .toISOString()
      .slice(0, 10),
  )
  return {
    assets: [
      { market: 'TWSE', code: '2330', weight: '0.5' },
      { market: 'TWSE', code: '2317', weight: '0.5' },
    ],
    strategy: 'fixed_weights',
    rebalance: 'monthly',
    lookback: 60,
    top_n: 2,
    basis: 'unadjusted',
    start_date: start,
    end_date: end,
    initial_cash: '1000000',
    commission_rate: '0.001425',
    sell_tax_rate: '0.003',
    slippage_rate: '0',
    minimum_fee: '20',
    lot_size: 1,
    allow_unverified_identity: false,
  }
}
export function portfolioPayload(
  query: PortfolioBacktestQuery,
): PortfolioBacktestQuery {
  if (query.assets.length < 2 || query.assets.length > 20)
    throw new Error('請指定 2–20 檔證券。')
  if (new Set(query.assets.map((a) => a.code)).size !== query.assets.length)
    throw new Error('投資組合的證券代碼不得重複，即使市場不同也不可重複配置。')
  if (
    query.assets.some(
      (a) => a.market === 'EMERGING' || !/^[0-9A-Z]{4,6}$/.test(a.code),
    )
  )
    throw new Error('請檢查市場與證券代碼；興櫃不適用開盤成交回測。')
  if (!query.start_date || !query.end_date || query.start_date > query.end_date)
    throw new Error('請選擇有效的開始與截止日期。')
  if (query.strategy === 'fixed_weights') {
    const weights = query.assets.map((a) =>
      a.weight === undefined || a.weight.trim() === '' ? NaN : Number(a.weight),
    )
    const total = weights.reduce((sum, v) => sum + v, 0)
    if (
      weights.some((v) => !Number.isFinite(v) || v < 0 || v > 1) ||
      total <= 0 ||
      total > 1 + Number.EPSILON * query.assets.length
    )
      throw new Error(
        '每檔權重須介於 0–1，總和須大於 0 且不超過 1；其餘保留現金。',
      )
    return {
      ...query,
      // Factor-only controls may be hidden after changing strategy.
      lookback: 60,
      top_n: 2,
      assets: query.assets.map((a) => ({ ...a })),
    }
  }
  if (query.top_n < 1 || query.top_n > query.assets.length)
    throw new Error('因子選入檔數不可超過候選證券數量。')
  return {
    ...query,
    assets: query.assets.map(({ market, code }) => ({ market, code })),
  }
}
export function safeSourceURL(value: string): string | undefined {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}
