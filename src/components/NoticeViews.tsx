import { Link } from 'react-router-dom'
import { fieldLabel, valueLabel } from '../features/market/fields'
import type {
  CalendarEvent,
  NoticeSource,
  RiskNotice,
} from '../services/notices'

export const riskLabels = {
  attention: '注意股票',
  disposition: '處置股票',
  suspension: '暫停交易公告',
}
const riskDataset = {
  attention: 'attention-securities',
  disposition: 'disposition-securities',
  suspension: 'suspended-securities',
}

export function NoticeSources({ sources }: { sources: NoticeSource[] }) {
  return (
    <section className="section" aria-label="官方來源取得狀態">
      <h2>本次官方來源</h2>
      <div className="notice-sources">
        {sources.map((source) => (
          <article className="event-card" key={source.id}>
            <h3>{source.title}</h3>
            <p>
              {source.status === 'ok'
                ? `本次取得 ${source.row_count?.toLocaleString()} 筆`
                : `未取得：${source.error}`}
            </p>
            {source.retrieved_at && (
              <p className="source-note">
                取得時間（臺北）：
                {new Intl.DateTimeFormat('zh-TW', {
                  timeZone: 'Asia/Taipei',
                  dateStyle: 'short',
                  timeStyle: 'medium',
                }).format(new Date(source.retrieved_at))}
              </p>
            )}
            <a href={source.source_url} target="_blank" rel="noreferrer">
              TWSE 官方來源 ↗
            </a>
          </article>
        ))}
      </div>
      <p className="source-note">
        取得時間不代表公告日期。只提供來源本次發布內容，不能查詢任意歷史資料。
      </p>
    </section>
  )
}

export function PartialNoticeWarning() {
  return (
    <p className="form-error" role="alert">
      部分官方來源未取得，本次結果不完整；請查看下方來源狀態並手動重新取得。
    </p>
  )
}

function RawFields({
  fields,
  dataset,
}: {
  fields: Record<string, string | null>
  dataset: string
}) {
  return (
    <details className="notice-details">
      <summary>官方欄位與原始內容</summary>
      <dl className="notice-fields">
        {Object.entries(fields).map(([key, value]) => (
          <div key={key}>
            <dt>
              {fieldLabel(key, dataset)}
              <small>{key}</small>
            </dt>
            <dd>{valueLabel(value)}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

export function CalendarCard({ event }: { event: CalendarEvent }) {
  return (
    <article className="notice-card">
      <div className="notice-card-heading">
        <span className="tag">
          {event.kind === 'market' ? '開休市公告' : '除權息'}
        </span>
        <span className="event-date">
          {event.date ?? '日期無法辨識'}
          {event.source_date && ` · 官方日期 ${event.source_date}`}
        </span>
      </div>
      <h3>{event.title}</h3>
      <p className="notice-description">
        {event.description || '來源未提供說明。'}
      </p>
      {event.code && <Link to={`/stocks/${event.code}`}>查看個股 →</Link>}
      <RawFields
        fields={event.fields}
        dataset={event.kind === 'market' ? 'market-calendar' : 'ex-dividend'}
      />
    </article>
  )
}

export function RiskCard({ notice }: { notice: RiskNotice }) {
  return (
    <article className="notice-card">
      <div className="notice-card-heading">
        <span className="tag">{riskLabels[notice.kind]}</span>
        <span className="event-date">
          {notice.kind === 'suspension' ? '暫停日期（來源）' : '公告日期'}：
          {notice.announced_on ?? notice.date_label ?? '來源未提供'}
        </span>
      </div>
      <h3>
        <Link to={`/stocks/${notice.code}`}>
          {notice.code} {notice.name}
        </Link>
      </h3>
      <p className="notice-description">
        {notice.description || '詳情請見官方欄位。'}
      </p>
      <a href={notice.source_url} target="_blank" rel="noreferrer">
        查看此類官方公告 ↗
      </a>
      <RawFields fields={notice.fields} dataset={riskDataset[notice.kind]} />
    </article>
  )
}

export function NoticePagination({
  path,
  query,
  pagination,
}: {
  path: string
  query: string
  pagination: { page: number; limit: number; total: number }
}) {
  const pages = Math.max(1, Math.ceil(pagination.total / pagination.limit))
  const link = (page: number) => {
    const params = new URLSearchParams(query)
    params.set('page', String(page))
    return `${path}?${params}`
  }
  if (!pagination.total) return null
  return (
    <nav className="pagination" aria-label="公告分頁">
      {pagination.page > 1 ? (
        <Link to={link(pagination.page > pages ? 1 : pagination.page - 1)}>
          {pagination.page > pages ? '返回第一頁' : '上一頁'}
        </Link>
      ) : (
        <span aria-disabled="true">上一頁</span>
      )}
      <span>
        第 {pagination.page} / {pages} 頁
      </span>
      {pagination.page < pages ? (
        <Link to={link(pagination.page + 1)}>下一頁</Link>
      ) : (
        <span aria-disabled="true">下一頁</span>
      )}
    </nav>
  )
}
