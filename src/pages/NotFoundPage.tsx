import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="page-heading">
      <p className="eyebrow">404 / PAGE NOT FOUND</p>
      <h1>找不到這個頁面</h1>
      <p className="intro">這個網址可能有誤，請透過上方導覽繼續探索。</p>
      <Link className="button" to="/">
        回到首頁 →
      </Link>
    </section>
  )
}
