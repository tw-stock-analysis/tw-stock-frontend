import { Link } from 'react-router-dom'
import { StockTable } from '../components/StockTable'
import { mockStocks } from '../features/stocks/mockStocks'

export function HomePage() {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">YOUR DAILY RESEARCH SPACE</p>
          <h1>
            看懂台股，
            <br />
            從你的研究開始。
          </h1>
          <p className="intro">
            從個股資訊到自選追蹤，整理值得關注的投資線索，建立自己的市場觀點。
          </p>
          <div className="actions">
            <Link className="button" to="/stocks">
              開始個股分析 <span aria-hidden="true">↗</span>
            </Link>
            <Link className="text-link" to="/watchlists/demo">
              查看自選股 <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <aside className="research-note" aria-label="研究工作區介紹">
          <span className="note-index">RESEARCH NOTES / 01</span>
          <h2>
            把關注，
            <br />
            變成研究的起點。
          </h2>
          <p>探索個股表現，將觀察標的集中在一個地方。</p>
          <div className="note-bottom">
            <span>探索 · 分析 · 追蹤</span>
            <span aria-hidden="true">↗</span>
          </div>
        </aside>
      </section>
      <section aria-labelledby="overview-heading" className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">AT A GLANCE</p>
            <h2 id="overview-heading">今日研究起點</h2>
          </div>
          <span className="muted">示範資料 · 非即時行情</span>
        </div>
        <div className="summary-grid">
          <article className="summary-card">
            <span className="label">探索標的</span>
            <strong>
              {mockStocks.length}
              <small> 檔</small>
            </strong>
            <Link to="/stocks">瀏覽個股分析 →</Link>
          </article>
          <article className="summary-card">
            <span className="label">示範自選清單</span>
            <strong>
              1<small> 份</small>
            </strong>
            <Link to="/watchlists/demo">開啟我的觀察清單 →</Link>
          </article>
          <article className="summary-card data-card">
            <span className="label">資料狀態</span>
            <h3>假資料展示</h3>
            <p>可直接瀏覽所有頁面，報價與清單皆為展示用資料。</p>
          </article>
        </div>
      </section>
      <section aria-labelledby="stocks-heading" className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">STOCK SNAPSHOT</p>
            <h2 id="stocks-heading">個股速覽</h2>
          </div>
          <Link className="text-link" to="/stocks">
            前往個股分析 →
          </Link>
        </div>
        <StockTable stocks={mockStocks} caption="示範個股" />
      </section>
    </>
  )
}
