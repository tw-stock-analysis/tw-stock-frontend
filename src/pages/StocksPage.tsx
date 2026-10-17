import { Form, useSearchParams } from 'react-router-dom'
import { StockTable } from '../components/StockTable'
import { mockStocks } from '../features/stocks/mockStocks'

export function StocksPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q')?.trim() ?? ''
  const stocks = mockStocks.filter(
    (stock) => stock.code.includes(query) || stock.name.includes(query),
  )

  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">STOCK RESEARCH</p>
        <h1>個股分析</h1>
        <p className="intro">從熟悉的公司開始，探索股價表現與基本面摘要。</p>
      </header>
      <Form className="search-form" role="search" action="/stocks">
        <label htmlFor="stock-search">搜尋股票代碼或名稱</label>
        <div className="search-row">
          <input
            key={query}
            id="stock-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="例如：2330 或台積電"
          />
          <button type="submit" className="button">
            搜尋
          </button>
        </div>
      </Form>
      <section className="section" aria-labelledby="results-heading">
        <div className="section-heading">
          <h2 id="results-heading">
            {query ? `「${query}」的搜尋結果` : '探索個股'}
            <span className="count">{stocks.length} 檔</span>
          </h2>
          <span className="muted">假資料 · 上市股票</span>
        </div>
        {stocks.length ? (
          <StockTable stocks={stocks} caption="個股分析列表" />
        ) : (
          <div className="empty-state">
            <h3>找不到符合的股票</h3>
            <p>
              目前僅提供台積電（2330）、鴻海（2317）、聯發科（2454）的假資料，請試試其他代碼或名稱。
            </p>
          </div>
        )}
      </section>
    </>
  )
}
