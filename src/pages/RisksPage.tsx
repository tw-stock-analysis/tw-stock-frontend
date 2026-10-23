import { Form, Link, useLoaderData, useRevalidator } from 'react-router-dom'
import {
  NoticePagination,
  NoticeSources,
  PartialNoticeWarning,
  RiskCard,
} from '../components/NoticeViews'
import {
  ResearchError,
  ResearchHeading,
  ResearchToolbar,
} from '../components/ResearchTools'
import type { RiskResponse } from '../services/notices'
import type { ResearchPageData } from '../services/research'

export function RisksPage() {
  const { response, error, query } =
    useLoaderData() as ResearchPageData<RiskResponse>
  const loading = useRevalidator().state !== 'idle'
  const params = new URLSearchParams(query)
  return (
    <>
      <ResearchHeading
        title="個股風險提示"
        description="依序查看官方注意、處置與暫停交易公告，保留官方日期、期間、措施及恢復交易資訊。"
      />
      <Form
        method="get"
        className="search-form screener-form"
        key={query}
        aria-label="風險公告條件"
      >
        <label>
          證券代碼（留空查看全部）
          <input
            name="code"
            pattern="[0-9A-Z]{4,6}"
            maxLength={6}
            placeholder="例如 2330、0050"
            defaultValue={params.get('code') ?? ''}
          />
        </label>
        <label>
          公告類型
          <select name="kind" defaultValue={params.get('kind') ?? 'all'}>
            <option value="all">全部三種公告</option>
            <option value="attention">注意股票</option>
            <option value="disposition">處置股票</option>
            <option value="suspension">暫停交易公告</option>
          </select>
        </label>
        <label>
          每頁筆數
          <select name="limit" defaultValue={params.get('limit') ?? '20'}>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
        <div className="screener-actions">
          <button className="button" type="submit" disabled={loading}>
            查詢公告
          </button>
          <Link to="/research/risks">清除條件</Link>
        </div>
      </Form>
      <ResearchToolbar
        note={
          response?.note ??
          '只彙整本次來源提供的官方公告，未列出不代表無其他風險或必然可交易；不自行判定公告目前是否生效。'
        }
      />
      {loading ? (
        <p role="status">正在依序取得官方公告，原結果暫時隱藏。</p>
      ) : error ? (
        <ResearchError message={error} />
      ) : (
        response && (
          <>
            {!response.complete && <PartialNoticeWarning />}
            <section className="section">
              <div className="section-heading">
                <h2>
                  本次公告
                  <span className="count">
                    {response.pagination.total.toLocaleString()} 筆
                  </span>
                </h2>
              </div>
              {response.data.length ? (
                <div className="notice-list">
                  {response.data.map((notice) => (
                    <RiskCard notice={notice} key={notice.id} />
                  ))}
                </div>
              ) : (
                <p className="empty-state">
                  {response.complete
                    ? '本頁未列出符合條件的公告。'
                    : '目前成功取得的來源未列出符合公告，查詢尚不完整。'}
                </p>
              )}
              <NoticePagination
                path="/research/risks"
                query={query}
                pagination={response.pagination}
              />
            </section>
            <NoticeSources sources={response.sources} />
          </>
        )
      )}
    </>
  )
}
