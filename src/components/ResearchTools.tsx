import { Link, NavLink, useRevalidator } from 'react-router-dom'
import { valueLabel } from '../features/market/fields'
import type { ResearchQuote } from '../services/research'

export function ResearchHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">TWSE · RESEARCH TOOLS</p>
        <h1>{title}</h1>
        <p className="intro">{description}</p>
      </header>
      <nav className="research-nav" aria-label="研究工具">
        <NavLink to="/research/screener">選股篩選器</NavLink>
        <NavLink to="/research/compare">股票比較</NavLink>
        <NavLink to="/research/overview">市場總覽</NavLink>
        <NavLink to="/research/calendar">除權息與日曆</NavLink>
        <NavLink to="/research/risks">風險公告</NavLink>
      </nav>
    </>
  )
}

export function ResearchToolbar({
  note = '官方日成交快照，非盤中即時報價。每次查詢都重新取得；成交量單位為股。',
}: { note?: string } = {}) {
  const revalidator = useRevalidator()
  return (
    <div className="source-toolbar">
      <p className="source-note">{note}</p>
      <button
        className="text-button"
        disabled={revalidator.state !== 'idle'}
        onClick={() => revalidator.revalidate()}
      >
        {revalidator.state !== 'idle' ? '正在取得…' : '重新取得'}
      </button>
    </div>
  )
}

export function ResearchError({ message }: { message: string }) {
  return (
    <section className="error-state" role="alert">
      <h2>無法完成查詢</h2>
      <p>{message}</p>
    </section>
  )
}

export function Percent({ value }: { value: string | null }) {
  const color =
    value && Number(value) > 0
      ? 'rise'
      : value && Number(value) < 0
        ? 'fall'
        : 'unchanged'
  return (
    <span className={color}>
      {value === null ? '—' : `${Number(value) > 0 ? '+' : ''}${value}%`}
    </span>
  )
}

export function ResearchTable({
  stocks,
  caption,
  selected,
  onSelect,
}: {
  stocks: ResearchQuote[]
  caption: string
  selected?: string[]
  onSelect?: (code: string) => void
}) {
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label={`${caption}，可橫向捲動`}
      tabIndex={0}
    >
      <table className="source-table research-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {onSelect && <th scope="col">比較</th>}
            <th scope="col">證券／代碼</th>
            <th scope="col">資料日期</th>
            <th scope="col">收盤價</th>
            <th scope="col">漲跌幅</th>
            <th scope="col">成交股數</th>
            <th scope="col">成交金額（元）</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock) => (
            <tr key={stock.code}>
              {onSelect && (
                <td>
                  <input
                    type="checkbox"
                    aria-label={`比較 ${stock.code} ${stock.name}`}
                    checked={selected?.includes(stock.code) ?? false}
                    disabled={
                      selected?.length === 4 && !selected.includes(stock.code)
                    }
                    onChange={() => onSelect(stock.code)}
                  />
                </td>
              )}
              <th scope="row">
                <Link className="stock-link" to={`/stocks/${stock.code}`}>
                  {stock.name}
                  <small>TWSE:{stock.code}</small>
                </Link>
              </th>
              <td>{valueLabel(stock.date)}</td>
              <td>{valueLabel(stock.closing_price)}</td>
              <td>
                <Percent value={stock.change_percent} />
              </td>
              <td>{valueLabel(stock.trade_volume)}</td>
              <td>{valueLabel(stock.trade_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
