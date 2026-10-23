import type { LoaderFunctionArgs } from 'react-router-dom'
import type { StockQuote, StockSource, StockValuation } from './stocks'
import { requestJSON } from './twse'

export interface ResearchQuote extends StockQuote {
  change_percent: string | null
}
export interface ScreenerResponse {
  data: ResearchQuote[]
  pagination: { page: number; limit: number; total: number }
  meta: StockSource
  calculation: string
}
export interface ComparisonResponse {
  data: {
    code: string
    quote: ResearchQuote | null
    valuation: StockValuation | null
  }[]
  quote_meta: StockSource
  valuation_meta: StockSource | null
  valuation_error: string | null
}
export interface OverviewResponse {
  total: number
  rising: number
  declining: number
  unchanged: number
  unclassified: number
  excluded: number
  gainers: ResearchQuote[]
  losers: ResearchQuote[]
  volume_leaders: ResearchQuote[]
  meta: StockSource
}
export interface ResearchPageData<T> {
  response: T | null
  error: string | null
  query: string
}

export function cleanQuery(search: string): string {
  const params = new URLSearchParams(search)
  for (const [key, value] of Array.from(params)) {
    if (value.trim() === '') params.delete(key)
  }
  return params.toString()
}

async function load<T>(
  path: string,
  request: Request,
  query: string,
): Promise<ResearchPageData<T>> {
  try {
    return {
      response: await requestJSON<T>(path, request.signal),
      error: null,
      query,
    }
  } catch (error) {
    if (request.signal.aborted) throw error
    return {
      response: null,
      error: error instanceof Error ? error.message : '目前無法取得資料。',
      query,
    }
  }
}

export function loadScreener({ request }: LoaderFunctionArgs) {
  const query = cleanQuery(new URL(request.url).search)
  return load<ScreenerResponse>(
    `/api/v1/research/screener?${query}`,
    request,
    query,
  )
}

export function loadOverview({ request }: LoaderFunctionArgs) {
  return load<OverviewResponse>('/api/v1/research/overview', request, '')
}

export function loadComparison({
  request,
}: Pick<LoaderFunctionArgs, 'request'>): Promise<
  ResearchPageData<ComparisonResponse>
> {
  const input = new URL(request.url).searchParams.get('codes') ?? ''
  const codes = input
    .trim()
    .toUpperCase()
    .split(/[,，\s]+/)
    .filter(Boolean)
  const query = codes.join(',')
  if (!input.trim())
    return Promise.resolve({ response: null, error: null, query })
  if (
    codes.length < 2 ||
    codes.length > 4 ||
    new Set(codes).size !== codes.length ||
    codes.some((code) => !/^[0-9A-Z]{4,6}$/.test(code))
  ) {
    return Promise.resolve({
      response: null,
      error: '請輸入 2～4 個不同的證券代碼，以逗號分隔，例如 0050,2330。',
      query,
    })
  }
  return load<ComparisonResponse>(
    `/api/v1/research/compare?${new URLSearchParams({ codes: query })}`,
    request,
    query,
  )
}

export async function exportScreener(
  query: string,
  signal: AbortSignal,
): Promise<Blob> {
  const response = await fetch(`/api/v1/research/screener/export?${query}`, {
    signal,
    cache: 'no-store',
  })
  if (
    !response.ok ||
    !response.headers.get('content-type')?.startsWith('text/csv')
  ) {
    throw new Error('無法匯出本次資料，請稍後重試。')
  }
  return response.blob()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Defer revocation so browsers can begin the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
