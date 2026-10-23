import { Link, useLoaderData, useRevalidator } from 'react-router-dom'
import { StockSourceInfo } from '../components/StockSourceInfo'
import { StockRiskPanel } from '../components/StockRiskPanel'
import { chartNumber, valueLabel } from '../features/market/fields'
import type { StockDetailData } from '../services/stocks'

function Values({ items }: { items: [string, string | null][] }) {
  return (
    <dl className="summary-grid">
      {items.map(([label, value]) => (
        <div className="summary-card" key={label}>
          <dt>{label}</dt>
          <dd className="source-value">{valueLabel(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

export function StockDetailPage() {
  const { code, quote, error, notFound, valuation, margin } =
    useLoaderData() as StockDetailData
  const revalidator = useRevalidator()
  const loading = revalidator.state !== 'idle'
  const stock = !loading && !error ? quote?.data : null
  const change = chartNumber(stock?.change)
  const changeClass =
    change === null || change === 0 ? 'unchanged' : change > 0 ? 'rise' : 'fall'
  return (
    <>
      <header className="page-heading">
        <Link className="text-link" to="/stocks">
          ← 搜尋上市證券
        </Link>
        <p className="eyebrow">TWSE:{code} · 上市證券</p>
        <h1>
          {loading
            ? `正在取得 ${code}…`
            : notFound
              ? '找不到這個證券代碼'
              : stock
                ? stock.name
                : `${code} · 個股資料`}
        </h1>
        <div className="source-toolbar">
          <p className="intro">成交、估值與資券各自依官方發布日期呈現。</p>
          <button
            className="button"
            disabled={loading}
            onClick={() => revalidator.revalidate()}
          >
            {loading ? '正在向 TWSE 取得…' : '重新取得個股資料'}
          </button>
        </div>
      </header>
      {loading ? (
        <p className="source-status" role="status">
          正在依序取得成交、估值與資券資料，原結果暫時隱藏。
        </p>
      ) : error ? (
        <section className="error-state" role="alert">
          <h2>{notFound ? '本次官方資料未列出此代碼' : '無法取得官方資料'}</h2>
          <p>{error}</p>
        </section>
      ) : (
        stock &&
        quote && (
          <>
            <section aria-labelledby="quote-heading">
              <div className="quote-panel">
                <div>
                  <h2 id="quote-heading">收盤價</h2>
                  <strong className="quote-price">
                    {valueLabel(stock.closing_price)}
                  </strong>
                  <p className={changeClass}>
                    漲跌價差：{valueLabel(stock.change)}
                  </p>
                </div>
                <span className="tag">資料日期 {valueLabel(stock.date)}</span>
              </div>
              <div className="section">
                <Values
                  items={[
                    ['開盤價', stock.opening_price],
                    ['最高價', stock.highest_price],
                    ['最低價', stock.lowest_price],
                    ['成交股數', stock.trade_volume],
                    ['成交金額（來源單位）', stock.trade_value],
                    ['成交筆數', stock.transactions],
                  ]}
                />
              </div>
              <StockSourceInfo meta={quote.meta} />
            </section>
            <section className="section" aria-labelledby="valuation-heading">
              <div className="section-heading">
                <h2 id="valuation-heading">交易估值</h2>
              </div>
              {valuation.error ? (
                <div className="error-state" role="alert">
                  <h3>估值資料暫時無法取得</h3>
                  <p>{valuation.error}</p>
                </div>
              ) : (
                valuation.response && (
                  <>
                    {valuation.response.data ? (
                      <Values
                        items={[
                          ['本益比（倍）', valuation.response.data.pe_ratio],
                          [
                            '殖利率（%）',
                            valuation.response.data.dividend_yield,
                          ],
                          [
                            '股價淨值比（倍）',
                            valuation.response.data.pb_ratio,
                          ],
                        ]}
                      />
                    ) : (
                      <p className="empty-state">
                        官方本次未提供此證券的估值資料。
                      </p>
                    )}
                    <StockSourceInfo meta={valuation.response.meta} />
                  </>
                )
              )}
            </section>
            <section className="section" aria-labelledby="margin-heading">
              <div className="section-heading">
                <h2 id="margin-heading">融資融券</h2>
                <span className="muted">數值沿用來源單位</span>
              </div>
              {margin.error ? (
                <div className="error-state" role="alert">
                  <h3>資券資料暫時無法取得</h3>
                  <p>{margin.error}</p>
                </div>
              ) : (
                margin.response && (
                  <>
                    {margin.response.data ? (
                      <div
                        className="table-scroll"
                        role="region"
                        aria-label="融資融券明細，可橫向捲動"
                        tabIndex={0}
                      >
                        <table className="source-table">
                          <caption>
                            {stock.name} · 官方融資融券明細，來源未提供資料日期
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">項目</th>
                              <th scope="col">融資</th>
                              <th scope="col">融券</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(
                              [
                                [
                                  '前日餘額',
                                  margin.response.data.margin_previous_balance,
                                  margin.response.data.short_previous_balance,
                                ],
                                [
                                  '買進',
                                  margin.response.data.margin_buy,
                                  margin.response.data.short_buy,
                                ],
                                [
                                  '賣出',
                                  margin.response.data.margin_sell,
                                  margin.response.data.short_sell,
                                ],
                                [
                                  '現金／現券償還',
                                  margin.response.data.margin_repayment,
                                  margin.response.data.short_repayment,
                                ],
                                [
                                  '今日餘額',
                                  margin.response.data.margin_balance,
                                  margin.response.data.short_balance,
                                ],
                                [
                                  '限額',
                                  margin.response.data.margin_limit,
                                  margin.response.data.short_limit,
                                ],
                              ] as const
                            ).map(([label, financed, shorted]) => (
                              <tr key={label}>
                                <th scope="row">{label}</th>
                                <td>{valueLabel(financed)}</td>
                                <td>{valueLabel(shorted)}</td>
                              </tr>
                            ))}
                            <tr>
                              <th scope="row">資券互抵</th>
                              <td colSpan={2}>
                                {valueLabel(margin.response.data.offsetting)}
                              </td>
                            </tr>
                            <tr>
                              <th scope="row">註記</th>
                              <td colSpan={2}>
                                {valueLabel(margin.response.data.note)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="empty-state">
                        官方本次未提供此證券的資券資料。
                      </p>
                    )}
                    <StockSourceInfo meta={margin.response.meta} />
                  </>
                )
              )}
            </section>
            <StockRiskPanel code={code} key={code} />
            <p className="source-note">
              每次進入或重新取得，都依序發出新的來源請求。各區塊的資料日期可能不同，缺值以「—」呈現。
            </p>
          </>
        )
      )}
    </>
  )
}
