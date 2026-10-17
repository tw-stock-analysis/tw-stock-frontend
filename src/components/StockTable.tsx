import { Link } from 'react-router-dom'
import { changeClass, demoTradeDate, formatChange, type Stock } from '../features/stocks/mockStocks'

export function StockTable({ stocks, caption }: { stocks: Stock[]; caption: string }) {
  return (
    <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table>
        <caption>
          {caption} · 假資料交易日 {demoTradeDate}
        </caption>
        <thead>
          <tr>
            <th scope="col">股票 / 代碼</th>
            <th scope="col">產業</th>
            <th scope="col">收盤價（元）</th>
            <th scope="col">漲跌幅</th>
            <th scope="col">成交量（張）</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock) => (
            <tr key={stock.instrumentId}>
              <th scope="row">
                <Link className="stock-link" to={`/stocks/${stock.instrumentId}`}>
                  {stock.name} <small>TWSE:{stock.code}</small>
                </Link>
              </th>
              <td className="muted">{stock.industry}</td>
              <td className="numeric">{stock.price}</td>
              <td className={`numeric ${changeClass(stock.changePercent)}`}>
                {formatChange(stock.changePercent)}
              </td>
              <td className="numeric">{stock.volume}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="table-note">價格單位：新臺幣元 · 成交量：1 張 = 1,000 股</p>
    </div>
  )
}
