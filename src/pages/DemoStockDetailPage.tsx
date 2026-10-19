import { Link, useLoaderData } from 'react-router-dom'
import { changeClass, demoTradeDate, formatChange, mockStocks } from '../features/stocks/mockStocks'

export function DemoStockDetailPage() {
  const { instrumentId } = useLoaderData() as { instrumentId: string }
  const stock = mockStocks.find((item) => item.instrumentId === instrumentId)

  if (!stock)
    return (
      <section className="page-heading">
        <p className="eyebrow">STOCK RESEARCH</p>
        <h1>找不到這檔股票</h1>
        <p className="intro">目前沒有此標的的示範資料。</p>
        <Link className="text-link" to="/stocks">
          返回個股分析 →
        </Link>
      </section>
    )

  return (
    <>
      <header className="page-heading">
        <Link className="text-link" to="/stocks">
          ← 所有個股
        </Link>
        <p className="eyebrow">
          TWSE:{stock.code} · 上市 · {stock.industry}
        </p>
        <h1>{stock.name}</h1>
        <p className="intro">個股摘要 · 假資料交易日 {demoTradeDate}</p>
      </header>
      <section className="quote-panel" aria-labelledby="quote-heading">
        <div>
          <h2 id="quote-heading">
            收盤價 <span className="muted">新臺幣元</span>
          </h2>
          <strong className="quote-price">{stock.price}</strong>
          <p className={changeClass(stock.changePercent)}>
            漲跌幅 {formatChange(stock.changePercent)}
          </p>
        </div>
        <span className="tag">假資料展示</span>
      </section>
      <section className="section" aria-labelledby="fundamentals-heading">
        <div className="section-heading">
          <h2 id="fundamentals-heading">基本面摘要</h2>
          <span className="muted">假資料基準日 {demoTradeDate}</span>
        </div>
        <dl className="summary-grid">
          <div className="summary-card">
            <dt>本益比</dt>
            <dd>
              {stock.pe}
              <small> 倍</small>
            </dd>
          </div>
          <div className="summary-card">
            <dt>殖利率</dt>
            <dd>
              {stock.yieldPercent}
              <small> %</small>
            </dd>
          </div>
          <div className="summary-card">
            <dt>成交量</dt>
            <dd>
              {stock.volume}
              <small> 張</small>
            </dd>
          </div>
        </dl>
      </section>
      <p className="demo-notice">以上報價及指標皆為假資料，僅供版面展示，不代表實際市場數值。</p>
    </>
  )
}
