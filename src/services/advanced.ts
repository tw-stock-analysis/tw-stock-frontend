import type { LoaderFunctionArgs } from 'react-router-dom'
import { taipeiDate, type AnalysisSection } from './analysis'
import { requestJSON, type SourceRow } from './twse'

export const researchTopics = {
  valuation: '歷史估值',
  dividends: '歷年股利',
  fill: '收盤填息',
  financials: '財報與 EPS',
  adjusted: '還原股價',
  ownership: '大戶持股分級',
  brokers: '券商分點',
  etf: '主動式 ETF 持股',
} as const
export type ResearchTopic = keyof typeof researchTopics
export interface ResearchBlock {
  id: string
  title: string
  required_plan: 'Free' | 'Backer' | 'Sponsor'
  columns: { key: string; label: string }[]
  result: AnalysisSection<SourceRow>
}
export interface AdvancedResearch {
  code: string
  name: string
  topic: ResearchTopic
  start_date: string
  end_date: string
  complete: boolean
  notes: string[]
  blocks: ResearchBlock[]
}
export interface AdvancedPageData {
  basePath?: string
  code: string
  topic: ResearchTopic
  start: string
  end: string
  response: AdvancedResearch | null
  error: string | null
}
export function isResearchTopic(value: string): value is ResearchTopic {
  return Object.hasOwn(researchTopics, value)
}
export async function loadAdvancedResearch({
  params,
  request,
}: Pick<LoaderFunctionArgs, 'params' | 'request'>): Promise<AdvancedPageData> {
  const candidate = params.topic ?? ''
  if (!isResearchTopic(candidate))
    throw new Response('找不到此研究功能', { status: 404 })
  const query = new URL(request.url).searchParams
  const end = query.get('end_date') ?? taipeiDate()
  const day = new Date(`${end}T00:00:00Z`)
  const start =
    query.get('start_date') ??
    (candidate === 'brokers'
      ? end
      : Number.isFinite(day.valueOf())
        ? new Date(day.valueOf() - (candidate === 'etf' ? 30 : 365) * 86400000)
            .toISOString()
            .slice(0, 10)
        : '')
  const code = params.code ?? ''
  const basePath = params.market
    ? `/instruments/${params.market}/${code}`
    : `/stocks/${code}`
  const result: AdvancedPageData = {
    code,
    basePath,
    topic: candidate,
    start,
    end,
    response: null,
    error: null,
  }
  if (!/^[0-9A-Z]{4,6}$/.test(code))
    return { ...result, error: '請使用有效的上市證券代碼。' }
  try {
    const search = new URLSearchParams({
      topic: candidate,
      start_date: start,
      end_date: end,
    })
    const response = await requestJSON<AdvancedResearch>(
      `/api/v1${basePath}/research?${search}`,
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
