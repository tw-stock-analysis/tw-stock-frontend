import { AuthError } from './auth'
import { taipeiDate } from './analysis'

export const markets = {
  TWSE: '上市',
  TPEX: '上櫃',
  EMERGING: '興櫃',
  DELISTED: '下市櫃',
} as const
export type Market = keyof typeof markets
export interface InstrumentRef {
  market: Market
  code: string
}
export interface Instrument extends InstrumentRef {
  name: string
  industry: string | null
  reference_date: string | null
  delisted_on: string | null
  historical_identity: 'source_limited' | 'ambiguous'
  note: string
  records: {
    name: string
    market: Market
    source_date: string | null
    kind: string
  }[]
}
export const rules = {
  min_revenue_yoy: '月營收年增率下限（%）',
  min_gross_margin: '毛利率下限（%）',
  min_operating_margin: '營業利益率下限（%）',
  max_debt_ratio: '負債比上限（%）',
  min_foreign_streak: '外資連買筆數下限',
  min_trust_streak: '投信連買筆數下限',
} as const
export type Rule = keyof typeof rules
export const metrics = {
  revenue_yoy: '月營收年增率（%）',
  gross_margin: '毛利率（%）',
  operating_margin: '營業利益率（%）',
  debt_ratio: '負債比（%）',
  foreign_streak: '外資連買筆數',
  trust_streak: '投信連買筆數',
} as const
export interface FactorQuery {
  instruments: InstrumentRef[]
  as_of: string
  rules: Partial<Record<Rule, string>>
  sort: 'code' | keyof typeof metrics
  descending: boolean
}
export interface FactorResult {
  complete: boolean
  note: string
  rows: (InstrumentRef & {
    name: string | null
    status: string
    matches: boolean | null
    metrics: Record<keyof typeof metrics, string | null>
    dates: Record<string, string>
    error: { message: string } | null
  })[]
}
export type LedgerEntry = InstrumentRef & {
  kind: 'buy' | 'sell' | 'dividend' | 'split'
  date: string
  quantity?: string
  price?: string
  fees?: string
  taxes?: string
  amount?: string
  ratio?: string
}
export type Document =
  | { kind: 'screen'; name: string; query: FactorQuery }
  | { kind: 'note'; name: string; instrument: InstrumentRef; body: string }
  | {
      kind: 'chart'
      name: string
      instrument: InstrumentRef
      overlay: 'ma' | 'bollinger'
      indicator: 'rsi' | 'macd'
      days: number
    }
  | { kind: 'comparison'; name: string; instruments: InstrumentRef[] }
  | { kind: 'portfolio'; name: string; ledger: LedgerEntry[] }
export type Kind = Document['kind']
export interface WorkspaceItem {
  id: string
  kind: Kind
  name: string
  version: number
  document: Document
  updated_at: string
}
export interface Valuation {
  complete: boolean
  as_of: string
  realized: string
  dividends: string
  unrealized: string | null
  total_pnl: string | null
  note: string
  positions: (InstrumentRef & {
    quantity: string
    cost: string
    realized: string
    dividends: string
    last_price: string | null
    price_date: string | null
    market_value: string | null
    unrealized: string | null
    fees_and_taxes: string
    error: string | null
    error_message?: string
  })[]
}
export interface BacktestResult {
  instrument: Instrument
  final_equity: string
  return_percent: string
  max_drawdown_percent: string
  fees_and_taxes: string
  notes: string[]
  orders: {
    date: string
    side: string
    quantity: string
    price: string
    fee: string
    tax: string
  }[]
  equity: {
    date: string
    equity: string
    cash: string
    quantity: string
    close: string
  }[]
}

export async function labRequest<T>(
  path: string,
  signal: AbortSignal,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal.aborted) controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 65_000)
  try {
    const response = await fetch('/api/v1' + path, {
      method,
      signal: controller.signal,
      credentials: 'same-origin',
      cache: 'no-store',
      headers:
        method === 'GET'
          ? {}
          : { 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    controller.signal.throwIfAborted()
    if (response.status === 204 && response.ok) return undefined as T
    const data = await response.json()
    controller.signal.throwIfAborted()
    if (!response.ok) {
      const validation = data.error?.code === 'VALIDATION_ERROR'
      throw new AuthError(
        validation
          ? '輸入條件不正確，請檢查日期、數值與候選筆數。'
          : (data.error?.message ?? '查詢暫時無法完成。'),
        response.status,
        data.error?.code,
      )
    }
    return data as T
  } catch (error) {
    if (signal.aborted)
      throw new DOMException('Request cancelled', 'AbortError')
    if (timedOut) throw new AuthError('本次查詢逾時，請縮小範圍後手動重試。')
    if (error instanceof AuthError) throw error
    throw new AuthError('無法完成連線或辨識回應，請稍後手動重試。')
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}

export function parseRefs(value: string): InstrumentRef[] {
  const refs = value
    .split(/[\n,，]+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((value) => {
      const parts = value.toUpperCase().split(':')
      const market = parts.length === 1 ? 'TWSE' : parts[0]
      const code = parts.length === 1 ? parts[0] : parts[1]
      if (
        parts.length > 2 ||
        !(market in markets) ||
        !code ||
        !/^[0-9A-Z]{4,6}$/.test(code)
      )
        throw new Error(
          '請使用 TWSE:2330、TPEX:6488 等市場與代碼格式，每行一檔。',
        )
      return { market: market as Market, code }
    })
  if (new Set(refs.map((r) => `${r.market}:${r.code}`)).size !== refs.length)
    throw new Error('候選證券不得重複。')
  return refs
}
export function formatRefs(refs: InstrumentRef[]) {
  return refs.map((r) => `${r.market}:${r.code}`).join('\n')
}
export function instrumentPath(ref: InstrumentRef) {
  return `/instruments/${ref.market}/${ref.code}`
}
export function defaultScreen(): FactorQuery {
  return {
    instruments: [{ market: 'TWSE', code: '2330' }],
    as_of: taipeiDate(),
    rules: { min_revenue_yoy: '0' },
    sort: 'code',
    descending: false,
  }
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : '本次操作未完成。'
}
