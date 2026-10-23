import { Form, Link, useLoaderData, useRevalidator } from 'react-router-dom'
import {
  Percent,
  ResearchError,
  ResearchHeading,
  ResearchToolbar,
} from '../components/ResearchTools'
import { StockSourceInfo } from '../components/StockSourceInfo'
import { valueLabel } from '../features/market/fields'
import type { ComparisonResponse, ResearchPageData } from '../services/research'

export function ComparisonPage() {
  const { response, error, query } =
    useLoaderData() as ResearchPageData<ComparisonResponse>
  const loading = useRevalidator().state !== 'idle'
  const rows = response
    ? ([
        [
          '成交資料日期',
          response.data.map((item) => valueLabel(item.quote?.date)),
        ],
        [
          '收盤價（元）',
          response.data.map((item) => valueLabel(item.quote?.closing_price)),
        ],
        [
          '漲跌幅',
          response.data.map((item) =>
            item.quote ? <Percent value={item.quote.change_percent} /> : '—',
          ),
        ],
        [
          '成交股數',
          response.data.map((item) => valueLabel(item.quote?.trade_volume)),
        ],
        [
          '成交金額（元）',
          response.data.map((item) => valueLabel(item.quote?.trade_value)),
        ],
        [
          '估值資料日期',
          response.data.map((item) => valueLabel(item.valuation?.date)),
        ],
        [
          '本益比（倍）',
          response.data.map((item) => valueLabel(item.valuation?.pe_ratio)),
        ],
        [
          '股價淨值比（倍）',
          response.data.map((item) => valueLabel(item.valuation?.pb_ratio)),
        ],
        [
          '殖利率（%）',
          response.data.map((item) =>
            valueLabel(item.valuation?.dividend_yield),
          ),
        ],
      ] as const)
    : []
  return (
    <>
      <ResearchHeading
        title="股票比較"
        description="並排查看 2～4 檔上市證券的成交與估值，分別保留來源日期與原始數值。"
      />
      <Form method="get" className="search-form" aria-label="股票比較條件">
        <label htmlFor="comparison-codes">證券代碼（以逗號分隔）</label>
        <div className="search-row">
          <input
            id="comparison-codes"
            name="codes"
            key={query}
            defaultValue={query}
            maxLength={100}
            placeholder="例如 0050,2330,2317"
            required
          />
          <button className="button" type="submit">
            開始比較
          </button>
        </div>
      </Form>
      {query && <ResearchToolbar />}
      {loading ? (
        <p role="status">正在依序取得成交與估值資料，原結果暫時隱藏。</p>
      ) : error ? (
        <ResearchError message={error} />
      ) : response ? (
        <section className="section">
          {response.valuation_error && (
            <p className="form-error" role="alert">
              估值資料暫時無法取得：{response.valuation_error}
            </p>
          )}
          <div
            className="table-scroll"
            role="region"
            aria-label="股票比較，可橫向捲動"
            tabIndex={0}
          >
            <table className="source-table comparison-table">
              <caption>
                上市證券成交與估值比較 · — 表示來源未提供或無法計算
              </caption>
              <thead>
                <tr>
                  <th scope="col">項目</th>
                  {response.data.map((item) => (
                    <th scope="col" key={item.code}>
                      {item.quote ? (
                        <Link
                          className="stock-link"
                          to={`/stocks/${item.code}`}
                        >
                          {item.quote.name}
                          <small>TWSE:{item.code}</small>
                        </Link>
                      ) : (
                        <>
                          {item.code}
                          <small>本次日成交資料找不到此代碼</small>
                        </>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, values]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {values.map((value, index) => (
                      <td key={response.data[index].code}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="source-note">
            漲跌幅以漲跌價差 ÷（收盤價 − 漲跌價差）× 100 計算。ETF
            等證券可能沒有估值；成交與估值日期可能不同。
          </p>
          <h2 className="section">成交資料來源</h2>
          <StockSourceInfo meta={response.quote_meta} perRecordDate />
          {response.valuation_meta && (
            <>
              <h2 className="section">估值資料來源</h2>
              <StockSourceInfo meta={response.valuation_meta} perRecordDate />
            </>
          )}
        </section>
      ) : (
        <div className="empty-state">
          輸入證券代碼開始比較，或從選股篩選器勾選 2～4 檔證券。
        </div>
      )}
    </>
  )
}
