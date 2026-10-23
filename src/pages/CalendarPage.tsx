import { useEffect, useRef, useState } from 'react'
import { Form, Link, useLoaderData, useRevalidator } from 'react-router-dom'
import {
  CalendarCard,
  NoticePagination,
  NoticeSources,
  PartialNoticeWarning,
} from '../components/NoticeViews'
import {
  ResearchError,
  ResearchHeading,
  ResearchToolbar,
} from '../components/ResearchTools'
import {
  exportCalendar,
  upcomingDates,
  type CalendarResponse,
} from '../services/notices'
import { downloadBlob, type ResearchPageData } from '../services/research'

function CalendarDownload({ query }: { query: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const download = async () => {
    const current = new AbortController()
    controller.current?.abort()
    controller.current = current
    setLoading(true)
    setError(null)
    setNote(null)
    try {
      const { blob, skipped } = await exportCalendar(query, current.signal)
      current.signal.throwIfAborted()
      downloadBlob(blob, 'twse-calendar.ics')
      setNote(
        skipped
          ? `已下載；${skipped} 筆日期不明資料未納入日曆。`
          : '已下載日曆，可匯入 Google、Apple 或 Outlook 日曆。',
      )
    } catch (error) {
      if (!current.signal.aborted)
        setError(error instanceof Error ? error.message : '日曆下載失敗。')
    } finally {
      if (!current.signal.aborted) setLoading(false)
    }
  }
  return (
    <div>
      <button className="text-button" disabled={loading} onClick={download}>
        {loading ? '正在產生日曆…' : '下載完整日期事件 ICS'}
      </button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {note && (
        <p role="status" className="source-note">
          {note}
        </p>
      )}
    </div>
  )
}

export function CalendarPage() {
  const { response, error, query } =
    useLoaderData() as ResearchPageData<CalendarResponse>
  const loading = useRevalidator().state !== 'idle'
  const params = new URLSearchParams(query)
  const dateLink = (upcoming: boolean) => {
    const next = new URLSearchParams(query)
    next.delete('page')
    next.delete('from_date')
    next.delete('to_date')
    if (upcoming)
      for (const [key, value] of Object.entries(upcomingDates()))
        next.set(key, value)
    return `/research/calendar?${next}`
  }
  return (
    <>
      <ResearchHeading
        title="除權息與交易日曆"
        description="彙整官方除權息預告與開休市事項，按日期查看，並下載為可匯入的日曆檔。"
      />
      <Form
        method="get"
        className="search-form screener-form"
        key={query}
        aria-label="日曆篩選條件"
      >
        <label>
          事件類型
          <select name="kind" defaultValue={params.get('kind') ?? 'all'}>
            <option value="all">全部事件</option>
            <option value="ex_dividend">除權息預告</option>
            <option value="market">開休市公告</option>
          </select>
        </label>
        <label>
          代碼、名稱或事項
          <input
            name="q"
            type="search"
            maxLength={100}
            defaultValue={params.get('q') ?? ''}
            placeholder="例如 0050、春節"
          />
        </label>
        <label>
          每頁筆數
          <select name="limit" defaultValue={params.get('limit') ?? '20'}>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
        <label>
          起日
          <input
            name="from_date"
            type="date"
            defaultValue={params.get('from_date') ?? ''}
          />
        </label>
        <label>
          迄日
          <input
            name="to_date"
            type="date"
            defaultValue={params.get('to_date') ?? ''}
          />
        </label>
        <div className="screener-actions">
          <button className="button" type="submit" disabled={loading}>
            查詢事件
          </button>
          <Link to="/research/calendar">清除條件</Link>
        </div>
      </Form>
      <div className="category-links">
        <Link to={dateLink(true)}>未來 30 天（含今天）</Link>
        <Link to={dateLink(false)}>全部來源日期</Link>
      </div>
      <ResearchToolbar note="只篩選官方本次發布的日期，不額外查詢歷史資料；開休市公告包含開始交易等事項，不將全部事件當成休市日。" />
      {loading ? (
        <p role="status">正在依序取得日曆來源，原事件暫時隱藏。</p>
      ) : error ? (
        <ResearchError message={error} />
      ) : (
        response && (
          <>
            {!response.complete && <PartialNoticeWarning />}
            <div className="section-heading section">
              <h2>
                官方事件
                <span className="count">
                  {response.pagination.total.toLocaleString()} 筆
                </span>
              </h2>
              {response.complete && (
                <CalendarDownload query={query} key={query} />
              )}
            </div>
            <p className="source-note">
              日曆下載會重新取得所選來源的完整篩選結果，不受分頁限制；是單次匯入檔，不會自動同步後續公告異動。
            </p>
            {response.undated > 0 && (
              <p className="source-note">
              另有 {response.undated}{' '}
                筆來源日期無法辨識，無法納入日期篩選及日曆下載。
              </p>
            )}
            {response.data.length ? (
              <div className="notice-list">
                {response.data.map((event) => (
                  <CalendarCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                {response.complete
                  ? '本頁沒有符合條件的官方事件。'
                  : '成功取得的來源中沒有符合事件，查詢尚不完整。'}
              </div>
            )}
            <NoticePagination
              path="/research/calendar"
              query={query}
              pagination={response.pagination}
            />
            <NoticeSources sources={response.sources} />
          </>
        )
      )}
    </>
  )
}
