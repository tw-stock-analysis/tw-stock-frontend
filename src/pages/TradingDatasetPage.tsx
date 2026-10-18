import { useMemo, useState } from 'react'
import {
  Link,
  useLoaderData,
  useLocation,
  useRevalidator,
} from 'react-router-dom'
import { TradingVisual } from '../components/TradingVisual'
import { fieldLabel, filterRows, valueLabel } from '../features/market/fields'
import { categories, type DatasetPageData } from '../services/twse'

const PAGE_SIZE = 50
export function TradingDatasetPage() {
  const data = useLoaderData() as DatasetPageData
  return <DatasetContent key={data.dataset.id} {...data} />
}

function DatasetContent({ dataset, response, error }: DatasetPageData) {
  const label = (column: string) => fieldLabel(column, dataset.id)
  const revalidator = useRevalidator()
  const { pathname } = useLocation()
  const loading = revalidator.state !== 'idle'
  const [query, setQuery] = useState('')
  const [field, setField] = useState('')
  const [value, setValue] = useState('')
  const [page, setPage] = useState(1)
  const rows = useMemo(
    () => filterRows(response?.data ?? [], query, field, value),
    [response, query, field, value],
  )
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleRows = rows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )
  const title =
    dataset.id === 'daily-prices' && pathname === '/stocks'
      ? '個股分析'
      : dataset.title
  return (
    <>
      <header className="page-heading">
        <Link className="text-link" to="/market">
          ← 所有交易資料
        </Link>
        <p className="eyebrow">TWSE · {categories[dataset.category].title}</p>
        <h1>{title}</h1>
        <p className="intro">{dataset.description}</p>
        <div className="source-toolbar">
          <a href={dataset.source_url} target="_blank" rel="noreferrer">
            官方資料來源 ↗
          </a>
          <button
            className="button"
            type="button"
            disabled={loading}
            onClick={() => revalidator.revalidate()}
          >
            {loading ? '正在向 TWSE 取得…' : '重新取得 TWSE 資料'}
          </button>
        </div>
      </header>
      <div className="source-status" role="status" aria-live="polite">
        {loading ? (
          '正在取得資料，原結果暫時隱藏。'
        ) : error ? (
          '本次來源請求失敗'
        ) : response ? (
          <>
            本次取得 {response.meta.row_count.toLocaleString()} 筆 ·
            取得時間（臺北）
            {new Intl.DateTimeFormat('zh-TW', {
              timeZone: 'Asia/Taipei',
              dateStyle: 'short',
              timeStyle: 'medium',
            }).format(new Date(response.meta.retrieved_at))}
          </>
        ) : (
          '尚未取得資料'
        )}
      </div>
      <p className="source-note">
        每次開啟此頁都重新請求。資料日期、交易時段及單位以官方欄位為準；取得時間不等於成交時間。
      </p>
      {error && !loading && (
        <section className="error-state" role="alert">
          <h2>無法取得官方資料</h2>
          <p>{error}</p>
          <p>本頁不以舊資料或假資料替代。</p>
        </section>
      )}
      {response && !loading && !error && (
        <>
          <form
            className="search-form filter-form"
            role="search"
            onSubmit={(event) => event.preventDefault()}
          >
            <div>
              <label htmlFor="record-search">{dataset.search_hint}</label>
              <input
                id="record-search"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div>
              <label htmlFor="record-field">指定官方欄位</label>
              <select
                id="record-field"
                value={field}
                onChange={(event) => {
                  setField(event.target.value)
                  setValue('')
                  setPage(1)
                }}
              >
                <option value="">全部欄位</option>
                {response.columns.map((column) => (
                  <option key={column} value={column}>
                    {label(column)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="field-value">欄位包含文字</label>
              <input
                id="field-value"
                value={value}
                disabled={!field}
                onChange={(event) => {
                  setValue(event.target.value)
                  setPage(1)
                }}
                placeholder={
                  dataset.view === 'calendar' || dataset.view === 'events'
                    ? '例如：來源日期或事由'
                    : '例如：代碼、名稱或來源日期'
                }
              />
            </div>
          </form>
          {!response.data.length ? (
            <div className="empty-state">
              <h2>官方本次回傳空資料</h2>
              <p>沒有可顯示的資料列，請依來源發布時間重新取得。</p>
            </div>
          ) : !rows.length ? (
            <div className="empty-state">
              <h2>沒有符合篩選的資料</h2>
              <button
                className="text-button"
                onClick={() => {
                  setQuery('')
                  setField('')
                  setValue('')
                  setPage(1)
                }}
              >
                清除篩選
              </button>
            </div>
          ) : (
            <>
              <TradingVisual
                dataset={dataset}
                columns={response.columns}
                rows={rows}
              />
              <section className="section" aria-labelledby="records-heading">
                <div className="section-heading">
                  <h2 id="records-heading">
                    {dataset.view === 'balances'
                      ? '餘額與交易統計明細'
                      : dataset.view === 'holdings'
                        ? '持股統計明細'
                        : dataset.view === 'events' ||
                            dataset.view === 'calendar'
                          ? '官方事項明細'
                          : '官方資料明細'}
                    <span className="count">
                      {rows.length.toLocaleString()} 筆
                    </span>
                  </h2>
                  <span className="muted">可橫向捲動查看所有欄位</span>
                </div>
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="官方資料表，可橫向捲動"
                >
                  <table className="source-table">
                    <caption>{dataset.title} · 官方欄位與原始數值</caption>
                    <thead>
                      <tr>
                        {response.columns.map((column) => (
                          <th scope="col" key={column}>
                            {label(column)}
                            {label(column) !== column && (
                              <small>{column}</small>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row, index) => (
                        <tr key={index}>
                          {response.columns.map((column) => (
                            <td key={column}>{valueLabel(row[column])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pagination" aria-label="資料分頁">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    上一頁
                  </button>
                  <span>
                    第 {currentPage} / {pageCount} 頁 · 每頁 {PAGE_SIZE} 筆
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    下一頁
                  </button>
                </div>
              </section>
            </>
          )}
          <details className="endpoint-details">
            <summary>資料來源與端點</summary>
            <p>
              後端：<code>{dataset.endpoint}</code>
            </p>
            <p>
              TWSE：<a href={dataset.source_url}>{dataset.path}</a>
            </p>
            <p>
              署名：臺灣證券交易所。
              <a href="https://openapi.twse.com.tw/">官方文件與授權說明</a>
            </p>
          </details>
        </>
      )}
    </>
  )
}
