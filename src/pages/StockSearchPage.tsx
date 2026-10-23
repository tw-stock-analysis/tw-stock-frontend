import { Form, Link, useLoaderData, useRevalidator } from 'react-router-dom'
import { StockSourceInfo } from '../components/StockSourceInfo'
import { valueLabel } from '../features/market/fields'
import type { StockSearchPageData } from '../services/stocks'

export function StockSearchPage() {
  const { q, response, error } = useLoaderData() as StockSearchPageData
  const revalidator = useRevalidator()
  const loading = revalidator.state !== 'idle'
  const pagination = response?.pagination
  const pages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.limit))
    : 1
  const pageLink = (page: number) =>
    `/stocks?${new URLSearchParams({ q, page: String(page) })}`
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">TWSE · STOCK RESEARCH</p>
        <h1>個股分析</h1>
        <p className="intro">
          搜尋上市證券代碼或名稱，查看官方成交、交易估值與融資融券資料。
        </p>
        <Link className="text-link" to="/research/screener">依股價、漲跌幅與成交量篩選 →</Link>
      </header>
      <Form method="get" className="search-form" role="search">
        <label htmlFor="stock-search">搜尋證券代碼或名稱</label>
        <div className="search-row">
          <input
            id="stock-search"
            name="q"
            type="search"
            key={q}
            defaultValue={q}
            maxLength={100}
            placeholder="例如：2330、台積電、0050"
          />
          <button className="button" type="submit">
            搜尋
          </button>
        </div>
      </Form>
      <div className="source-toolbar">
        <p className="source-note">
          每次搜尋、換頁或重新取得，都向 TWSE
          發出新請求。範圍以本次官方日成交資料為準。
        </p>
        <button
          className="text-button"
          disabled={loading}
          onClick={() => revalidator.revalidate()}
        >
          {loading ? '正在取得…' : '重新取得'}
        </button>
      </div>
      {loading ? (
        <p role="status">正在向 TWSE 取得資料，原結果暫時隱藏。</p>
      ) : error ? (
        <section className="error-state" role="alert">
          <h2>無法取得官方資料</h2>
          <p>{error}</p>
        </section>
      ) : (
        response && (
          <>
            <section className="section" aria-labelledby="stocks-heading">
              <div className="section-heading">
                <h2 id="stocks-heading">
                  搜尋結果
                  <span className="count">
                    {response.pagination.total.toLocaleString()} 檔
                  </span>
                </h2>
              </div>
              {!response.data.length ? (
                <div className="empty-state">
                  <h3>本次沒有符合條件的證券</h3>
                  <p>可改用代碼或部分名稱搜尋。</p>
                </div>
              ) : (
                <div
                  className="table-scroll"
                  role="region"
                  aria-label="上市證券搜尋結果，可橫向捲動"
                  tabIndex={0}
                >
                  <table className="source-table">
                    <caption>上市證券日成交資訊 · 點選名稱查看詳情</caption>
                    <thead>
                      <tr>
                        <th scope="col">證券／代碼</th>
                        <th scope="col">資料日期</th>
                        <th scope="col">收盤價</th>
                        <th scope="col">漲跌價差</th>
                        <th scope="col">成交股數</th>
                      </tr>
                    </thead>
                    <tbody>
                      {response.data.map((stock) => (
                        <tr key={stock.code}>
                          <th scope="row">
                            <Link
                              className="stock-link"
                              to={`/stocks/${stock.code}`}
                            >
                              {stock.name}
                              <small>TWSE:{stock.code}</small>
                            </Link>
                          </th>
                          <td>{valueLabel(stock.date)}</td>
                          <td>{valueLabel(stock.closing_price)}</td>
                          <td>{valueLabel(stock.change)}</td>
                          <td>{valueLabel(stock.trade_volume)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {pagination && pagination.total > 0 && (
                <nav className="pagination" aria-label="搜尋結果分頁">
                  {pagination.page > 1 ? (
                    <Link to={pageLink(pagination.page - 1)}>上一頁</Link>
                  ) : (
                    <span aria-disabled="true">上一頁</span>
                  )}
                  <span>
                    第 {pagination.page} / {pages} 頁 · 每頁 {pagination.limit}{' '}
                    檔
                  </span>
                  {pagination.page < pages ? (
                    <Link to={pageLink(pagination.page + 1)}>下一頁</Link>
                  ) : (
                    <span aria-disabled="true">下一頁</span>
                  )}
                </nav>
              )}
            </section>
          <StockSourceInfo meta={response.meta} perRecordDate />
          </>
        )
      )}
    </>
  )
}
