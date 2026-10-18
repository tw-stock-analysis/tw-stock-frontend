import { useState } from 'react'
import { Link, useLoaderData } from 'react-router-dom'
import { categories, type TradingCatalog } from '../services/twse'

export function TradingCatalogPage() {
  const catalog = useLoaderData() as TradingCatalog
  const [query, setQuery] = useState('')
  const datasets = catalog.data.filter((dataset) =>
    `${dataset.title} ${dataset.description} ${dataset.path}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">TWSE · MARKET DATA</p>
        <h1>交易資料</h1>
        <p className="intro">
          依研究目的選擇官方資料。每個功能頁都會直接向 TWSE 取得最新發布內容。
        </p>
        <div className="catalog-meta">
          <span className="tag">{catalog.data.length} 個官方 API</span>
          <span>價格 · 指數 · 外資 · 資券 · 權證 · ETF</span>
        </div>
      </header>
      <div className="search-form">
        <label htmlFor="dataset-search">尋找交易資料功能</label>
        <input
          className="wide-input"
          id="dataset-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="例如：零股、融資、休市或 STOCK_DAY_ALL"
        />
      </div>
      <nav className="category-links" aria-label="交易資料分類">
        {Object.entries(categories).map(([id, category]) => (
          <a href={`#category-${id}`} key={id}>
            {category.title}
          </a>
        ))}
      </nav>
      {!datasets.length && (
        <div className="empty-state">
          <h2>找不到符合的資料功能</h2>
          <p>請換一個關鍵字。</p>
        </div>
      )}
      {Object.entries(categories).map(([id, category]) => {
        const items = datasets.filter((dataset) => dataset.category === id)
        if (!items.length) return null
        return (
          <section
            className="section catalog-section"
            id={`category-${id}`}
            key={id}
            aria-labelledby={`heading-${id}`}
          >
            <div className="section-heading">
              <div>
                <h2 id={`heading-${id}`}>
                  {category.title}
                  <span className="count">{items.length}</span>
                </h2>
                <p className="muted">{category.description}</p>
              </div>
            </div>
            <div className="dataset-grid">
              {items.map((dataset) => (
                <article className="dataset-card" key={dataset.id}>
                  <h3>
                    <Link to={dataset.page_path}>{dataset.title}</Link>
                  </h3>
                  <p>{dataset.description}</p>
                  <code>{dataset.path}</code>
                  <Link className="text-link" to={dataset.page_path}>
                    開啟查詢 →
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )
      })}
      <p className="demo-notice">
        外資持股與法人買賣超的統計意義不同。本來源目錄沒有三大法人每日買賣超
        API；本輪未加入其他資料來源。
      </p>
    </>
  )
}
