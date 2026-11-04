import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ResearchHeading } from '../components/ResearchTools'
import { ResearchSources } from '../components/ResearchSources'
import { useResearchRequest } from '../components/useResearchRequest'
import { taipeiDate } from '../services/analysis'
import {
  defaultMarketScreen,
  financialMetrics,
  financialRules,
  type MarketScreenQuery,
  type MarketScreenResult,
  type TradingMarket,
} from '../services/advancedLab'
import { instrumentPath, labRequest, markets } from '../services/lab'

export function MarketScreenPage() {
  const [draft, setDraft] = useState<MarketScreenQuery>(defaultMarketScreen)
  const [submitted, setSubmitted] = useState<MarketScreenQuery | null>(null)
  const request = useResearchRequest<MarketScreenResult>()
  function run(query: MarketScreenQuery) {
    void request.run(async (signal) => {
      if (!query.markets.length) throw new Error('請至少選擇一個市場。')
      if (!/-(03-31|06-30|09-30|12-31)$/.test(query.report_date))
        throw new Error('財報日期請選擇 3/31、6/30、9/30 或 12/31 季末日。')
      setSubmitted(query)
      return labRequest<MarketScreenResult>(
        '/research/market-screen',
        signal,
        'POST',
        query,
      )
    })
  }
  return (
    <>
      <ResearchHeading
        title="全市場基本面掃描"
        description="依指定市場查詢全市場營收與財報快照，一次評估所有來源候選；行情與結果不保存。"
      />
      <p className="source-note">
        全市場快照需要 FinMind
        相應付費權限。資料期間不等於正式公告時間，名錄為目前查得參考，不能把結果當成歷史時點的全市場選股回測。
      </p>
      <form
        className="search-form lab-form"
        onSubmit={(e) => {
          e.preventDefault()
          run({ ...draft, page: 1 })
        }}
      >
        <fieldset disabled={request.busy}>
          <div
            className="market-choice-group"
            role="group"
            aria-label="掃描市場"
          >
            {(['TWSE', 'TPEX', 'EMERGING'] as TradingMarket[]).map((m) => (
              <label key={m}>
                <input
                  type="checkbox"
                  checked={draft.markets.includes(m)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      markets: e.target.checked
                        ? [...draft.markets, m]
                        : draft.markets.filter((v) => v !== m),
                    })
                  }
                />
                {markets[m]}
              </label>
            ))}
          </div>
          <label>
            營收月份
            <input
              type="month"
              aria-label="營收月份"
              value={draft.revenue_month.slice(0, 7)}
              min="2001-01"
              max={defaultMarketScreen().revenue_month.slice(0, 7)}
              required
              onChange={(e) =>
                setDraft({
                  ...draft,
                  revenue_month: e.target.value ? e.target.value + '-01' : '',
                })
              }
            />
          </label>
          <label>
            財報季末日期
            <input
              type="date"
              aria-label="財報季末日期"
              value={draft.report_date}
              min="2001-01-01"
              max={taipeiDate()}
              required
              onChange={(e) =>
                setDraft({ ...draft, report_date: e.target.value })
              }
            />
          </label>
          {Object.entries(financialRules).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                aria-label={label}
                step="any"
                value={draft.rules[key as keyof typeof financialRules] ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rules: {
                      ...draft.rules,
                      [key]: e.target.value || undefined,
                    },
                  })
                }
              />
            </label>
          ))}
          <label>
            排序
            <select
              aria-label="全市場排序"
              value={draft.sort}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  sort: e.target.value as MarketScreenQuery['sort'],
                })
              }
            >
              <option value="code">市場與代碼</option>
              {Object.entries(financialMetrics).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            顯示候選
            <select
              aria-label="顯示候選"
              value={draft.result_filter}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  result_filter: e.target
                    .value as MarketScreenQuery['result_filter'],
                })
              }
            >
              <option value="matched">符合條件</option>
              <option value="all">全部候選與狀態</option>
              <option value="insufficient">資料不足／無法判定</option>
            </select>
          </label>
          <label>
            每頁筆數
            <select
              aria-label="每頁筆數"
              value={draft.limit}
              onChange={(e) =>
                setDraft({ ...draft, limit: Number(e.target.value) })
              }
            >
              {[20, 50, 100].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={draft.descending}
              onChange={(e) =>
                setDraft({ ...draft, descending: e.target.checked })
              }
            />
            由大到小排序
          </label>
          <button className="button">執行全市場掃描</button>
        </fieldset>
      </form>
      <p className="source-note">
        財報請選 3/31、6/30、9/30 或
        12/31。空白門檻不查該項；缺資料不算符合，也不算不符合。換頁會重新查詢全市場快照，來源更新時結果可能不同。
      </p>
      {request.busy && (
        <div className="source-toolbar">
          <p role="status">正在依序取得全市場快照，原結果暫時隱藏…</p>
          <button className="text-button" onClick={request.cancel}>
            取消本次掃描
          </button>
        </div>
      )}
      {request.cancelled && <p role="status">已取消本次掃描。</p>}
      {request.error && (
        <p role="alert" className="form-error">
          {request.error}
        </p>
      )}
      {request.result && !request.busy && (
        <section className="section">
          <h2>本次全市場掃描結果</h2>
          <ResearchSources sources={request.result.sources} />
          <dl className="lab-summary">
            {[
              ['候選總數', request.result.coverage.universe],
              ['符合', request.result.coverage.matched],
              ['不符合', request.result.coverage.not_matched],
              ['資料不足', request.result.coverage.insufficient],
              ['無法確認／來源錯誤', request.result.coverage.errors],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {!request.result.coverage.complete && (
            <p role="alert">
              部分候選資料不足或無法確認；請搭配候選狀態與涵蓋筆數解讀。
            </p>
          )}
          <ul>
            {request.result.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="全市場掃描結果，可橫向捲動"
          >
            <table className="source-table">
              <caption>
                資料期間：營收 {submitted?.revenue_month.slice(0, 7)} ／財報{' '}
                {submitted?.report_date}
              </caption>
              <thead>
                <tr>
                  <th>證券</th>
                  <th>判定</th>
                  {Object.values(financialMetrics).map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                  <th>資料期間／原因</th>
                </tr>
              </thead>
              <tbody>
                {request.result.rows.map((row) => (
                  <tr key={`${row.market}:${row.code}`}>
                    <th>
                      <Link to={instrumentPath(row)}>
                        {row.market}:{row.code} {row.name}
                      </Link>
                    </th>
                    <td>
                      {row.matches === true
                        ? '符合'
                        : row.matches === false
                          ? '不符合'
                          : row.status === 'error'
                            ? '無法判定'
                            : '資料不足'}
                    </td>
                    {Object.keys(financialMetrics).map((metric) => (
                      <td key={metric}>
                        {row.metrics[metric as keyof typeof financialMetrics] ??
                          '—'}
                      </td>
                    ))}
                    <td>
                      {row.error?.message ??
                        Object.values(row.dates).filter(Boolean).join('、')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!request.result.rows.length && (
            <p>本次顯示條件沒有候選；請參考上方全市場涵蓋筆數。</p>
          )}
          <p>
            {request.result.pagination.total} 筆 · 第{' '}
            {request.result.pagination.page} 頁
          </p>
          <nav className="research-nav" aria-label="全市場掃描分頁">
            <button
              className="text-button"
              disabled={!submitted || request.result.pagination.page <= 1}
              onClick={() =>
                submitted &&
                run({ ...submitted, page: request.result!.pagination.page - 1 })
              }
            >
              上一頁
            </button>
            <button
              className="text-button"
              disabled={
                !submitted ||
                request.result.pagination.page *
                  request.result.pagination.limit >=
                  request.result.pagination.total
              }
              onClick={() =>
                submitted &&
                run({ ...submitted, page: request.result!.pagination.page + 1 })
              }
            >
              下一頁
            </button>
          </nav>
        </section>
      )}
    </>
  )
}
