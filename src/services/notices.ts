import type { LoaderFunctionArgs } from 'react-router-dom'
import type { ResearchPageData } from './research'
import { cleanQuery } from './research'
import { requestJSON } from './twse'

export interface NoticeSource {
  id: string
  title: string
  source_url: string
  status: 'ok' | 'error'
  retrieved_at: string | null
  row_count: number | null
  error: string | null
}
export interface CalendarEvent {
  id: string
  kind: 'ex_dividend' | 'market'
  date: string | null
  source_date: string | null
  code: string | null
  name: string
  title: string
  description: string
  fields: Record<string, string | null>
  source_url: string
}
export interface RiskNotice {
  id: string
  kind: 'attention' | 'disposition' | 'suspension'
  code: string
  name: string
  announced_on: string | null
  date_label: string | null
  description: string
  fields: Record<string, string | null>
  source_url: string
}
export interface NoticeResponse<T> {
  data: T[]
  pagination: { page: number; limit: number; total: number }
  sources: NoticeSource[]
  complete: boolean
}
export interface CalendarResponse extends NoticeResponse<CalendarEvent> {
  undated: number
}
export interface RiskResponse extends NoticeResponse<RiskNotice> {
  note: string
}

async function load<T>(
  path: string,
  request: Request,
): Promise<ResearchPageData<T>> {
  const query = cleanQuery(new URL(request.url).search)
  try {
    return {
      response: await requestJSON<T>(`${path}?${query}`, request.signal),
      query,
      error: null,
    }
  } catch (error) {
    if (request.signal.aborted) throw error
    return {
      response: null,
      query,
      error: error instanceof Error ? error.message : '目前無法取得公告。',
    }
  }
}
export function loadCalendar({ request }: Pick<LoaderFunctionArgs, 'request'>) {
  return load<CalendarResponse>('/api/v1/research/calendar', request)
}
export function loadRisks({ request }: Pick<LoaderFunctionArgs, 'request'>) {
  return load<RiskResponse>('/api/v1/research/risks', request)
}
export function getStockRisks(code: string, signal: AbortSignal) {
  return requestJSON<RiskResponse>(
    `/api/v1/research/risks?${new URLSearchParams({ code, limit: '100' })}`,
    signal,
  )
}
export async function exportCalendar(query: string, signal: AbortSignal) {
  const response = await fetch(`/api/v1/research/calendar/export?${query}`, {
    signal,
    cache: 'no-store',
  })
  if (
    !response.ok ||
    !response.headers.get('content-type')?.startsWith('text/calendar')
  ) {
    throw new Error('無法下載完整日曆，請確認所選官方來源均可取得後重試。')
  }
  return {
    blob: await response.blob(),
    skipped: Number(response.headers.get('x-skipped-undated') ?? '0'),
  }
}

export function upcomingDates(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) =>
    parts.find((value) => value.type === type)!.value
  const start = `${part('year')}-${part('month')}-${part('day')}`
  const end = new Date(`${start}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 29)
  return { from_date: start, to_date: end.toISOString().slice(0, 10) }
}
