import { useQuery } from '@tanstack/react-query'
import { getHealth } from '../services/api'

export function App() {
  const api = useQuery({ queryKey: ['health', 'live'], queryFn: ({ signal }) => getHealth('live', signal) })
  const database = useQuery({ queryKey: ['health', 'ready'], queryFn: ({ signal }) => getHealth('ready', signal) })

  return (
    <main className="page">
      <header className="topbar"><span className="brand">台股研究室</span><span className="tag">開發環境</span></header>
      <section className="hero">
        <p className="eyebrow">TAIWAN EQUITY RESEARCH</p>
        <h1>從資料出發，<br />建立你的台股研究工具。</h1>
        <p className="intro">前後端骨架已建立。接下來將依序加入股票搜尋、基本面、技術圖表與會員自選股。</p>
      </section>
      <section aria-labelledby="status-heading" className="status-section">
        <h2 id="status-heading">服務連線</h2>
        <div className="status-grid">
          <article className="card"><span className="label">前端</span><h3>React + TypeScript</h3><p className="good">● 已載入</p></article>
          <article className="card"><span className="label">後端</span><h3>FastAPI</h3><Status pending={api.isPending} error={api.error} /></article>
          <article className="card"><span className="label">資料庫</span><h3>PostgreSQL</h3><Status pending={database.isPending} error={database.error} /></article>
        </div>
        <button type="button" onClick={() => { void api.refetch(); void database.refetch() }} disabled={api.isFetching || database.isFetching}>重新檢查連線</button>
      </section>
      <section className="next"><h2>第一階段</h2><p>目前提供環境驗證，尚未串接行情或建立會員功能。畫面不使用模擬報價。</p><a href="/api/v1/docs" target="_blank" rel="noreferrer">查看後端 API 文件 ↗</a></section>
      <footer>React → FastAPI → SQLAlchemy AsyncSession → asyncpg → PostgreSQL</footer>
    </main>
  )
}

function Status({ pending, error }: { pending: boolean; error: Error | null }) {
  if (pending) return <p role="status">檢查中…</p>
  if (error) return <p className="warning" role="status">{error.message}</p>
  return <p className="good" role="status">● 已連線</p>
}
