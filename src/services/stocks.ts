import type { LoaderFunctionArgs } from 'react-router-dom'
import { APIError, requestJSON } from './twse'

export interface StockSource {
  source: 'TWSE'
  source_url: string
  retrieved_at: string
  data_date: string | null
  retrieval: 'on_request'
  units: 'source_native'
  note: string
}
export interface StockQuote {
  code: string
  name: string
  date: string | null
  opening_price: string | null
  highest_price: string | null
  lowest_price: string | null
  closing_price: string | null
  change: string | null
  trade_volume: string | null
  trade_value: string | null
  transactions: string | null
}
export interface StockValuation {
  code: string
  name: string
  date: string | null
  pe_ratio: string | null
  dividend_yield: string | null
  pb_ratio: string | null
}
export interface StockMargin {
  code: string
  name: string
  margin_buy: string | null
  margin_sell: string | null
  margin_repayment: string | null
  margin_previous_balance: string | null
  margin_balance: string | null
  margin_limit: string | null
  short_sell: string | null
  short_buy: string | null
  short_repayment: string | null
  short_previous_balance: string | null
  short_balance: string | null
  short_limit: string | null
  offsetting: string | null
  note: string | null
}
export interface StockResponse<T> {
  data: T
  meta: StockSource
}
export interface StockSearchResponse extends StockResponse<StockQuote[]> {
  pagination: { page: number; limit: number; total: number }
}
export interface StockSearchPageData {
  q: string
  response: StockSearchResponse | null
  error: string | null
}
export interface StockSection<T> {
  response: StockResponse<T | null> | null
  error: string | null
}
export interface StockDetailData {
  code: string
  quote: StockResponse<StockQuote> | null
  error: string | null
  notFound: boolean
  valuation: StockSection<StockValuation>
  margin: StockSection<StockMargin>
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : '目前無法取得資料。'

async function loadSection<T>(
  path: string,
  signal: AbortSignal,
): Promise<StockSection<T>> {
  signal.throwIfAborted()
  try {
    return {
      response: await requestJSON<StockResponse<T | null>>(path, signal),
      error: null,
    }
  } catch (error) {
    if (signal.aborted) throw error
    return { response: null, error: message(error) }
  }
}

export async function loadStocks({
  request,
}: LoaderFunctionArgs): Promise<StockSearchPageData> {
  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const params = new URLSearchParams({
    q,
    page: url.searchParams.get('page') ?? '1',
    limit: '20',
  })
  try {
    return {
      q,
      response: await requestJSON<StockSearchResponse>(
        `/api/v1/stocks?${params}`,
        request.signal,
      ),
      error: null,
    }
  } catch (error) {
    if (request.signal.aborted) throw error
    return { q, response: null, error: message(error) }
  }
}

export async function loadStockDetail({
  params,
  request,
}: Pick<LoaderFunctionArgs, 'params' | 'request'>): Promise<StockDetailData> {
  const code = params.code ?? ''
  const result: StockDetailData = {
    code,
    quote: null,
    error: null,
    notFound: false,
    valuation: { response: null, error: null },
    margin: { response: null, error: null },
  }
  if (!/^[0-9A-Z]{4,6}$/.test(code)) {
    return { ...result, notFound: true, error: '請使用有效的上市證券代碼。' }
  }
  try {
    result.quote = await requestJSON<StockResponse<StockQuote>>(
      `/api/v1/stocks/${code}`,
      request.signal,
    )
  } catch (error) {
    if (request.signal.aborted) throw error
    return {
      ...result,
      notFound: error instanceof APIError && error.code === 'STOCK_NOT_FOUND',
      error: message(error),
    }
  }
  // Sections use separate fresh HTTP calls, in order. A failed optional section
  // does not replace this request's successful quote, and never uses old data.
  result.valuation = await loadSection<StockValuation>(
    `/api/v1/stocks/${code}/valuation`,
    request.signal,
  )
  result.margin = await loadSection<StockMargin>(
    `/api/v1/stocks/${code}/margin`,
    request.signal,
  )
  return result
}
