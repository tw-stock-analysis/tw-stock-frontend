import { Link, useLoaderData, useRevalidator } from 'react-router-dom'
import { fieldLabel, nameColumn, valueLabel } from '../features/market/fields'
import type { DatasetPageData } from '../services/twse'

const shortcuts = [
  [
    'daily-prices',
    '01',
    '個股價格與成交',
    '從代碼或名稱搜尋上市證券的官方成交資訊。',
  ],
  ['taiex-history', '02', '市場指數', '觀察加權指數歷史序列，掌握市場變化。'],
  ['foreign-industries', '03', '外資持股', '比較外資及陸資的類股持股比率。'],
  ['margin-balances', '04', '融資融券', '獨立檢視資券餘額與來源統計單位。'],
  ['attention-securities', '05', '注意與處置', '查詢官方注意股票及交易警示。'],
  ['market-calendar', '06', '開休市日曆', '依官方公告查看市場開休市日期。'],
]

export function HomePage() {
  const { response, error } = useLoaderData() as DatasetPageData
  const revalidator = useRevalidator()
  const loading = revalidator.state !== 'idle'
  const name = response ? nameColumn(response.columns) : undefined
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">TAIWAN STOCK EXCHANGE · OPEN DATA</p>
          <h1>
            看懂台股，
            <br />
            從官方資料開始。
          </h1>
          <p className="intro">
            從成交價格、指數到資券與交易警示，每次開頁都向證交所取得最新發布內容。
          </p>
          <div className="actions">
            <Link className="button" to="/market">
              探索交易資料 <span aria-hidden="true">↗</span>
            </Link>
            <Link className="text-link" to="/stocks">
              搜尋個股 →
            </Link>
            <Link className="text-link" to="/research/screener">選股篩選器 →</Link>
          </div>
        </div>
        <aside className="research-note">
          <span className="note-index">DIRECT FROM TWSE</span>
          <h2>
            一份資料，
            <br />
            一個研究起點。
          </h2>
          <p>
            依功能分類查詢價格、成交、持股與市場統計，保留官方原始欄位及數值。
          </p>
          <div className="note-bottom">
            <span>按次查詢 · 官方來源</span>
            <span aria-hidden="true">↗</span>
          </div>
        </aside>
      </section>
      <section className="section" aria-labelledby="indices-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MARKET OVERVIEW</p>
            <h2 id="indices-heading">官方指數概覽</h2>
          </div>
          <button
            className="text-button"
            disabled={loading}
            onClick={() => revalidator.revalidate()}
          >
            {loading ? '正在取得…' : '重新取得'}
          </button>
        </div>
        {loading ? (
          <p role="status">正在向 TWSE 取得指數…</p>
        ) : error ? (
          <div className="error-state" role="alert">
            <h3>無法取得官方資料</h3>
            <p>{error}</p>
          </div>
        ) : response && response.data.length ? (
          <>
            <div className="summary-grid">
              {response.data.slice(0, 3).map((row, index) => (
                <article className="summary-card" key={index}>
                  <h3>{name ? valueLabel(row[name]) : `指數 ${index + 1}`}</h3>
                  <dl className="index-values">
                    {response.columns
                      .filter((column) => column !== name)
                      .slice(0, 4)
                      .map((column) => (
                        <div key={column}>
                          <dt>{fieldLabel(column, response.dataset.id)}</dt>
                          <dd>{valueLabel(row[column])}</dd>
                        </div>
                      ))}
                  </dl>
                </article>
              ))}
            </div>
            <p className="source-note">
              資料日期與口徑以官方欄位為準；本次取得時間（臺北）：
              {new Date(response.meta.retrieved_at).toLocaleString('zh-TW', {
                timeZone: 'Asia/Taipei',
              })}
              。
            </p>
          </>
        ) : (
          <div className="empty-state">官方本次未提供指數資料。</div>
        )}
        <Link className="text-link" to="/market/market-indices">
          完整指數資料 →
        </Link>
      </section>
      <section className="section" aria-labelledby="research-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RESEARCH TOOLS</p>
            <h2 id="research-heading">選擇研究方向</h2>
          </div>
          <Link className="text-link" to="/market">
            所有交易功能 →
          </Link>
        </div>
        <div className="dataset-grid">
          {shortcuts.map(([id, number, title, description]) => (
            <article className="dataset-card" key={id}>
              <span className="eyebrow">{number}</span>
              <h3>
                <Link to={`/market/${id}`}>{title}</Link>
              </h3>
              <p>{description}</p>
              <Link className="text-link" to={`/market/${id}`}>
                開啟查詢 →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
