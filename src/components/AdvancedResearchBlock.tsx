import { useState } from 'react'
import type { ResearchBlock } from '../services/advanced'
import type { SourceRow } from '../services/twse'
import { valueLabel } from '../features/market/fields'
import { ResearchBars } from './HistoryCharts'

const CHART_FIELDS: Record<string, string[]> = {
  valuation: ['pe', 'pb', 'yield'],
  dividends: ['cash', 'stock'],
  earnings: [
    'eps',
    'revenue',
    'net_income',
    'gross_margin',
    'operating_margin',
  ],
  income: ['value'],
  balance: ['value'],
  cashflow: ['value', 'quarter_value'],
  adjusted: ['close'],
  prices: ['close'],
  ownership: ['percent', 'people', 'shares'],
  brokers: ['net', 'buy', 'sell'],
  holdings: ['weight', 'shares'],
  holding_changes: ['net', 'buy', 'sell'],
}
const GROUPS: Record<string, string> = {
  income: 'subject',
  balance: 'subject',
  cashflow: 'subject',
  ownership: 'level',
  holdings: 'holding_key',
  holding_changes: 'component',
}
const numeric = (value: string | null | undefined) => {
  if (value === null || value === undefined || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function AdvancedResearchBlock({ block }: { block: ResearchBlock }) {
  const fields = CHART_FIELDS[block.id] ?? []
  const groupKey = GROUPS[block.id]
  const rows = block.result.data ?? []
  const groups = groupKey
    ? [...new Set(rows.map((r) => r[groupKey] ?? ''))]
    : []
  const [field, setField] = useState(fields[0] ?? '')
  const [group, setGroup] = useState(groups[0] ?? '')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy')
  const filtered = rows.filter(
    (r) =>
      (!groupKey || (r[groupKey] ?? '') === group) &&
      Object.values(r).some((v) =>
        (v ?? '')
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
      ),
  )
  // The API already sorts exact Decimal net values. Reverse that order for sells;
  // converting large share counts to Number here would lose ranking precision.
  const ranked =
    block.id === 'brokers' && direction === 'sell'
      ? [...filtered].reverse()
      : filtered
  const ordered = block.id === 'brokers' ? ranked : [...filtered].reverse()
  const pageCount = Math.max(1, Math.ceil(ordered.length / 50))
  const currentPage = Math.min(page, pageCount)
  const label = block.columns.find((c) => c.key === field)?.label ?? field
  const { result } = block
  return (
    <section
      className="section advanced-block"
      aria-labelledby={`research-${block.id}`}
    >
      <div className="section-heading">
        <h2 id={`research-${block.id}`}>{block.title}</h2>
        {block.required_plan !== 'Free' && (
          <span className="tag">{block.required_plan} 資料權限</span>
        )}
      </div>
      {result.status !== 'ok' ? (
        <div className="error-state" role="alert">
          <p>{result.error?.message ?? '此區塊尚未取得資料。'}</p>
          {result.error?.code === 'FINMIND_ACCESS_DENIED' && (
            <p>請在後端設定具此資料權限的 FinMind Token，再手動重新取得。</p>
          )}
          {result.status === 'not_requested' && (
            <p>本次未繼續查詢或未進行衍生計算。</p>
          )}
        </div>
      ) : !rows.length ? (
        <p className="empty-state">來源在此查詢期間未提供資料。</p>
      ) : (
        <>
          <div className="analysis-controls">
            {block.id === 'brokers' && (
              <label>
                分點排行
                <select
                  aria-label="分點排行"
                  value={direction}
                  onChange={(e) => {
                    setDirection(e.target.value as typeof direction)
                    setPage(1)
                  }}
                >
                  <option value="buy">買超優先</option>
                  <option value="sell">賣超優先</option>
                </select>
              </label>
            )}
            {groups.length > 0 && (
              <label>
                資料分類
                <select
                  aria-label={`${block.title}資料分類`}
                  value={group}
                  onChange={(e) => {
                    setGroup(e.target.value)
                    setPage(1)
                  }}
                >
                  {groups.map((value) => {
                    const sample = rows.find(
                      (r) => (r[groupKey] ?? '') === value,
                    )
                    return (
                      <option key={value} value={value}>
                        {sample?.label
                          ? `${sample.label} · ${value}`
                          : block.id === 'holdings'
                            ? `${sample?.name ?? value} · ${sample?.asset_type ?? ''} · ${sample?.currency ?? ''}`
                            : sample?.name
                              ? `${sample.name} · ${value}`
                              : value || '未提供代碼'}
                      </option>
                    )
                  })}
                </select>
              </label>
            )}
            {fields.length > 1 && (
              <label>
                圖表數值
                <select
                  aria-label={`${block.title}圖表數值`}
                  value={field}
                  onChange={(e) => setField(e.target.value)}
                >
                  {fields.map((key) => (
                    <option value={key} key={key}>
                      {block.columns.find((c) => c.key === key)?.label ?? key}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              搜尋本次資料
              <input
                type="search"
                aria-label={`${block.title}搜尋本次資料`}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </label>
          </div>
          {block.id === 'valuation' && (
            <ValuationRange rows={filtered} field={field} label={label} />
          )}
          {field &&
            (block.id === 'brokers' ? (
              <ResearchBars
                title={`${block.title} · ${label}（前 20 名）`}
                unit="股"
                points={ranked
                  .slice(0, 20)
                  .map((r) => ({ date: r.broker ?? '', value: r[field] }))}
              />
            ) : (
              <ResearchLine
                title={`${block.title} · ${label}`}
                rows={filtered}
                field={field}
              />
            ))}
          {!filtered.length ? (
            <p className="empty-state">本次資料沒有符合條件的結果。</p>
          ) : (
            <div
              className="table-scroll"
              role="region"
              tabIndex={0}
              aria-label={`${block.title}明細，可橫向捲動`}
            >
              <table className="source-table">
                <caption>
                  {block.title} · 精確明細 · 共 {filtered.length} 筆
                </caption>
                <thead>
                  <tr>
                    {block.columns.map((column) => (
                      <th scope="col" key={column.key}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordered
                    .slice((currentPage - 1) * 50, currentPage * 50)
                    .map((row, i) => (
                      <tr key={i}>
                        {block.columns.map((column, j) =>
                          j === 0 ? (
                            <th scope="row" key={column.key}>
                              {valueLabel(row[column.key])}
                            </th>
                          ) : (
                            <td key={column.key}>
                              {valueLabel(row[column.key])}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          {pageCount > 1 && (
            <nav className="pagination" aria-label={`${block.title}分頁`}>
              <button
                className="text-button"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                上一頁
              </button>
              <span>
                第 {currentPage}／{pageCount} 頁
              </span>
              <button
                className="text-button"
                disabled={currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                下一頁
              </button>
            </nav>
          )}
        </>
      )}
      {result.meta && (
        <p className="source-note">
          來源：
          <a href={result.meta.source_url} target="_blank" rel="noreferrer">
            FinMind
          </a>{' '}
          · 取得時間{' '}
          {new Date(result.meta.retrieved_at).toLocaleString('zh-TW', {
            timeZone: 'Asia/Taipei',
          })}
          （台北） · 來源 {result.meta.row_count} 列
        </p>
      )}
    </section>
  )
}

function ValuationRange({
  rows,
  field,
  label,
}: {
  rows: SourceRow[]
  field: string
  label: string
}) {
  const valid = rows.flatMap((r) =>
    numeric(r[field]) === null
      ? []
      : [{ raw: r[field], value: numeric(r[field])! }],
  )
  if (!valid.length) return null
  const min = valid.reduce((a, b) => (a.value < b.value ? a : b))
  const max = valid.reduce((a, b) => (a.value > b.value ? a : b))
  const latest = valid.at(-1)!
  const position =
    max.value === min.value
      ? '—'
      : `${(((latest.value - min.value) / (max.value - min.value)) * 100).toFixed(2)}%`
  return (
    <p className="source-note">
      {label}：本次區間最低 {min.raw}、最高 {max.raw}、最後有效值 {latest.raw}
      ；高低區間位置約 {position}（最低 0%、最高 100%，非合理價或百分位排名）。
    </p>
  )
}

function ResearchLine({
  rows,
  field,
  title,
}: {
  rows: SourceRow[]
  field: string
  title: string
}) {
  const numbers = rows
    .map((r) => numeric(r[field]))
    .filter((n): n is number => n !== null)
  if (!numbers.length)
    return (
      <p className="source-note">此數值沒有足夠有效資料可繪圖，請查看明細。</p>
    )
  const min = Math.min(...numbers),
    max = Math.max(...numbers)
  const y = (v: number) =>
    max === min ? 110 : 25 + ((max - v) / (max - min)) * 170
  const x = (i: number) => 65 + ((i + 0.5) / rows.length) * 810
  let connected = false
  const d = rows
    .map((r, i) => {
      const v = numeric(r[field])
      if (v === null) {
        connected = false
        return ''
      }
      const command = connected ? 'L' : 'M'
      connected = true
      return `${command}${x(i)},${y(v)}`
    })
    .join(' ')
  const format = (v: number) =>
    new Intl.NumberFormat('zh-TW', {
      maximumFractionDigits: 2,
      notation: 'compact',
    }).format(v)
  return (
    <figure className="chart-card history-chart" tabIndex={0}>
      <figcaption>{title}</figcaption>
      <svg
        className="series-chart"
        viewBox="0 0 900 235"
        role="img"
        aria-label={title}
      >
        {[...new Set([max, min])].map((v) => (
          <g key={v}>
            <line x1="60" x2="880" y1={y(v)} y2={y(v)} stroke="#dfe6dd" />
            <text x="54" y={y(v) + 4} textAnchor="end">
              {format(v)}
            </text>
          </g>
        ))}
        <path d={d} fill="none" stroke="#176457" strokeWidth="2" />
        {rows.length === 1 && numbers.length === 1 && (
          <circle cx={x(0)} cy={y(numbers[0])} r="3" fill="#176457" />
        )}
        <text x="60" y="225">
          {rows[0]?.date}
        </text>
        <text x="880" y="225" textAnchor="end">
          {rows.at(-1)?.date}
        </text>
      </svg>
      <p className="source-note">
        圖形使用近似值，精確數字見明細；缺值不補零。
      </p>
    </figure>
  )
}
