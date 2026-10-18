import type { LoaderFunctionArgs } from 'react-router-dom'

export type TradingCategory =
  | 'prices'
  | 'indices'
  | 'foreign'
  | 'margin'
  | 'day-trading'
  | 'block'
  | 'alerts'
  | 'calendar'
  | 'warrants'
  | 'etf'
  | 'market'
export type TradingView =
  | 'prices'
  | 'series'
  | 'ranking'
  | 'holdings'
  | 'balances'
  | 'events'
  | 'calendar'
  | 'table'
export interface TradingDataset {
  id: string
  title: string
  category: TradingCategory
  view: TradingView
  path: string
  description: string
  search_hint: string
  source_url: string
  endpoint: string
  page_path: string
}
export type SourceRow = Record<string, string | null>
export interface TradingResponse {
  dataset: TradingDataset
  columns: string[]
  data: SourceRow[]
  meta: {
    source: 'TWSE'
    source_url: string
    retrieved_at: string
    retrieval: 'on_request'
    freshness: 'source_defined'
    units: 'source_native'
    row_count: number
    note: string
  }
}
export interface TradingCatalog {
  data: TradingDataset[]
  reference_url: string
  scope: string
}
export interface DatasetPageData {
  dataset: TradingDataset
  response: TradingResponse | null
  error: string | null
}

export const categories: Record<
  TradingCategory,
  { title: string; description: string }
> = {
  prices: {
    title: '價格與成交',
    description: '一般交易、零股、盤後定價與交易估值',
  },
  indices: { title: '市場指數', description: '加權、臺灣 50、寶島與報酬指數' },
  market: {
    title: '市場統計',
    description: '成交排行、委託成交、漲跌家數與市場量值',
  },
  foreign: { title: '外資持股', description: '類股持股比率與前 20 名彙總' },
  margin: {
    title: '融資融券與借券',
    description: '資券餘額、停資停券與可借券賣出額度',
  },
  'day-trading': {
    title: '當日沖銷',
    description: '當沖標的、暫停註記與先賣後買暫停資訊',
  },
  block: { title: '鉅額交易', description: '獨立查看日、月、年成交量值' },
  alerts: { title: '交易警示', description: '注意、處置、暫停及變更交易' },
  calendar: { title: '交易日曆', description: '開休市與除權除息預告' },
  warrants: { title: '權證交易', description: '每日成交資訊與交易人數' },
  etf: { title: 'ETF 與定期定額', description: '定期定額交易戶數排行月報' },
}

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message)
  }
}

export async function requestJSON<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  // No browser cache, query cache, automatic polling or retry.
  const response = await fetch(path, { signal, cache: 'no-store' })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = (
      body as { error?: { code?: string; request_id?: string } } | null
    )?.error
    const message =
      error?.code === 'STOCK_NOT_FOUND'
        ? '本次 TWSE 日成交資料中找不到此代碼。'
        : error?.code === 'VALIDATION_ERROR'
          ? '查詢條件格式不正確，請檢查代碼與分頁。'
          : error?.code === 'SOURCE_RATE_LIMITED'
            ? 'TWSE 暫時限制請求，請稍後再按重新取得。'
            : error?.code === 'SOURCE_DATA_INVALID'
              ? 'TWSE 回應格式無法辨識，請稍後重新取得。'
              : '目前無法取得 TWSE 資料，請確認後端與來源連線後重新取得。'
    throw new APIError(
      message + (error?.request_id ? `（追蹤碼：${error.request_id}）` : ''),
      response.status,
      error?.code,
    )
  }
  if (body === null) throw new Error('後端回應格式無法辨識。')
  return body as T
}

export function getTradingCatalog(signal?: AbortSignal) {
  return requestJSON<TradingCatalog>('/api/v1/twse/datasets', signal)
}

export function getTradingData(dataset: TradingDataset, signal?: AbortSignal) {
  if (!dataset.endpoint.startsWith('/api/v1/twse/'))
    throw new Error('資料端點無效。')
  return requestJSON<TradingResponse>(dataset.endpoint, signal)
}

export async function loadCatalog({ request }: LoaderFunctionArgs) {
  return getTradingCatalog(request.signal)
}

export async function loadDataset({
  params,
  request,
}: LoaderFunctionArgs): Promise<DatasetPageData> {
  const catalog = await getTradingCatalog(request.signal)
  const dataset = catalog.data.find((item) => item.id === params.datasetId)
  if (!dataset) throw new Response('找不到這個交易資料頁面', { status: 404 })
  try {
    return {
      dataset,
      response: await getTradingData(dataset, request.signal),
      error: null,
    }
  } catch (error) {
    if (request.signal.aborted) throw error
    return {
      dataset,
      response: null,
      error: error instanceof Error ? error.message : '目前無法取得資料。',
    }
  }
}
