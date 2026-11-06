import { StockTable } from '../components/StockTable'
import { mockStocks } from '../features/stocks/mockStocks'

export function WatchlistPage() {
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">YOUR WATCHLIST</p>
        <h1>自選股</h1>
        <p className="intro">把值得持續關注的公司，收進你的研究視野。</p>
      </header>
      <section className="section" aria-labelledby="watchlist-heading">
        <div className="section-heading">
          <div>
            <h2 id="watchlist-heading">
              我的觀察清單<span className="count">{mockStocks.length} 檔</span>
            </h2>
            <p className="muted">示範清單 · 點選股票名稱查詢真實個股摘要</p>
          </div>
          <span className="tag">假資料展示</span>
        </div>
        <StockTable stocks={mockStocks} caption="自選股觀察清單" />
      </section>
      <p className="demo-notice">
        此為固定的示範清單，價格為示範資料，尚未提供個人清單儲存及增刪功能；股票名稱連至真實資料頁。
      </p>
    </>
  )
}
