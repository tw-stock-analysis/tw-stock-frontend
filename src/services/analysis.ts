import type { LoaderFunctionArgs } from 'react-router-dom'
import { requestJSON } from './twse'

export interface AnalysisMeta {
  source: 'FinMind'
  dataset: string
  source_url: string
  retrieved_at: string
  query_start: string | null
  query_end: string | null
  row_count: number
  retrieval: 'on_request'
  price_basis: 'unadjusted' | 'source_adjusted' | null
  units: Record<string, string>
}
export interface AnalysisSection<T> {
  status: 'ok' | 'error' | 'not_requested'
  data: T[] | null
  meta: AnalysisMeta | null
  error: { code: string; message: string } | null
}
export interface HistoryPoint {
  date: string
  open: string
  high: string
  low: string
  close: string
  volume: string
  amount: string
  opening_reference: boolean
  price_available: boolean
  ma20: string | null
  ma60: string | null
  rsi14: string | null
  macd: string | null
  macd_signal: string | null
  macd_histogram: string | null
  bollinger_middle: string | null
  bollinger_upper: string | null
  bollinger_lower: string | null
}
export interface RevenuePoint {
  month: string
  revenue: string
  yoy: string | null
  mom: string | null
  record_date: string
  recorded_at: string | null
  ytd_revenue: string | null
  ytd_yoy: string | null
  trailing12_revenue: string | null
  trailing12_yoy: string | null
}
export interface InstitutionTrade {
  name: string
  label: string
  buy: string
  sell: string
  net: string
  net5: string | null
  net20: string | null
}
export interface InstitutionPoint {
  date: string
  trades: InstitutionTrade[]
}
export interface StockAnalysis {
  code: string
  name: string
  market: 'TWSE' | 'TPEX' | 'EMERGING' | 'DELISTED'
  start_date: string
  end_date: string
  revenue_start_month: string
  complete: boolean
  history: AnalysisSection<HistoryPoint>
  revenue: AnalysisSection<RevenuePoint>
  institutions: AnalysisSection<InstitutionPoint>
}
export interface AnalysisPageData {
  basePath?: string
  code: string
  start: string
  end: string
  response: StockAnalysis | null
  error: string | null
}

export function taipeiDate(): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join('-')
}

export async function loadStockAnalysis({
  params,
  request,
}: Pick<LoaderFunctionArgs, 'params' | 'request'>): Promise<AnalysisPageData> {
  const query = new URL(request.url).searchParams
  const end = query.get('end_date') ?? taipeiDate()
  const day = new Date(`${end}T00:00:00Z`)
  const start =
    query.get('start_date') ??
    (Number.isFinite(day.valueOf())
      ? new Date(day.valueOf() - 180 * 86400000).toISOString().slice(0, 10)
      : '')
  const code = params.code ?? ''
  const basePath = params.market
    ? `/instruments/${params.market}/${code}`
    : `/stocks/${code}`
  const result: AnalysisPageData = {
    code,
    basePath,
    start,
    end,
    response: null,
    error: null,
  }
  if (!/^[0-9A-Z]{4,6}$/.test(code))
    return { ...result, error: '請使用有效的上市證券代碼。' }
  try {
    const search = new URLSearchParams({ start_date: start, end_date: end })
    const response = await requestJSON<StockAnalysis>(
      `/api/v1${basePath}/analysis?${search}`,
      request.signal,
    )
    request.signal.throwIfAborted()
    return { ...result, response }
  } catch (error) {
    if (request.signal.aborted) throw error
    return {
      ...result,
      error: error instanceof Error ? error.message : '目前無法取得研究資料。',
    }
  }
}
