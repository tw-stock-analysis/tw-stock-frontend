import { useState, type ReactNode } from 'react'
import { Form, Link, useLoaderData, useRevalidator } from 'react-router-dom'
import {
  RevenueResearch,
  TechnicalResearch,
} from '../components/AnalysisResearch'
import { ResearchBars } from '../components/HistoryCharts'
import { valueLabel } from '../features/market/fields'
import {
  taipeiDate,
  type AnalysisPageData,
  type AnalysisSection,
  type InstitutionPoint,
} from '../services/analysis'

function SourceResult<T>({
  result,
  children,
}: {
  result: AnalysisSection<T>
  children: (points: T[]) => ReactNode
}) {
  if (result.status !== 'ok')
    return (
      <div role="alert" className="error-state">
        <p>{result.error?.message ?? '此區塊尚未取得資料。'}</p>
        {result.status === 'not_requested' && (
          <p>來源存取受限，本次未繼續查詢此區塊。</p>
        )}
      </div>
    )
  return (
    <>
      {result.data?.length ? (
        children(result.data)
      ) : (
        <p className="empty-state">來源在此查詢期間未提供資料。</p>
      )}
      {result.meta && (
        <p className="source-note">
          來源：
          <a href="https://finmindtrade.com/" target="_blank" rel="noreferrer">
            FinMind
          </a>{' '}
          · 取得時間{' '}
          {new Date(result.meta.retrieved_at).toLocaleString('zh-TW', {
            timeZone: 'Asia/Taipei',
          })}
          （台北）
        </p>
      )}
    </>
  )
}

function Institutions({ points }: { points: InstitutionPoint[] }) {
  const categories = [
    ...new Map(
      points.flatMap((p) => p.trades.map((t) => [t.name, t.label] as const)),
    ).entries(),
  ]
  const [selected, setSelected] = useState(
    categories.some(([name]) => name === 'Foreign_Investor')
      ? 'Foreign_Investor'
      : (categories[0]?.[0] ?? ''),
  )
  const rows = points.map((point) => ({
    date: point.date,
    trade: point.trades.find((t) => t.name === selected),
  }))
  const name = categories.find(([key]) => key === selected)?.[1] ?? selected
  return (
    <>
      <label className="institution-select">
        法人分類
        <select
          aria-label="法人分類"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {categories.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <ResearchBars
        title={`${name}每日買賣超`}
        unit="股"
        points={rows.map((p) => ({
          date: p.date,
          value: p.trade?.net ?? null,
        }))}
      />
      <p className="source-note">
        買賣超為買進減賣出。累計使用最近 5／20
        個來源有資料的日期；該分類缺漏或筆數不足時留空。各分類分別呈現，不重複加總。
      </p>
      <details>
        <summary>查看法人買賣明細</summary>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="法人買賣明細，可橫向捲動"
        >
          <table className="source-table">
            <caption>{name} · 單位：股</caption>
            <thead>
              <tr>
                {[
                  '日期',
                  '買進',
                  '賣出',
                  '買賣超',
                  '近 5 筆合計',
                  '近 20 筆合計',
                ].map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map(({ date, trade }) => (
                <tr key={date}>
                  <th scope="row">{date}</th>
                  {[
                    trade?.buy,
                    trade?.sell,
                    trade?.net,
                    trade?.net5,
                    trade?.net20,
                  ].map((v, i) => (
                    <td key={i}>{valueLabel(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  )
}

export function StockAnalysisPage() {
  const { code, start, end, response, error } =
    useLoaderData() as AnalysisPageData
  const revalidator = useRevalidator()
  const loading = revalidator.state !== 'idle'
  return (
    <>
      <header className="page-heading">
        <Link className="text-link" to={`/stocks/${code}`}>
          ← 返回個股摘要
        </Link>
        <p className="eyebrow">FINMIND · 歷史研究</p>
        <h1>
          {response ? `${response.name} · 歷史研究` : `${code} · 歷史研究`}
        </h1>
        <p className="intro">
          查看原始日線、月營收與法人買賣；各項依來源提供的期間呈現。
        </p>
      </header>
      <Form
        method="get"
        className="search-form history-form"
        key={`${start}/${end}`}
      >
        <label>
          日線與法人開始日期
          <input
            type="date"
            name="start_date"
            defaultValue={start}
            min="1994-10-01"
            max={taipeiDate()}
            required
          />
        </label>
        <label>
          查詢截止日期
          <input
            type="date"
            name="end_date"
            defaultValue={end}
            min="1994-10-01"
            max={taipeiDate()}
            required
          />
        </label>
        <button className="button" type="submit" disabled={loading}>
          查詢研究資料
        </button>
        <button
          className="text-button"
          type="button"
          disabled={loading}
          onClick={() => revalidator.revalidate()}
        >
          重新取得
        </button>
        <p className="source-note">
          日線與法人最多查詢 366 天；營收顯示截止月份往前最多 36
          個月。股價未還原，不直接作為含息報酬。
        </p>
      </Form>
      {loading ? (
        <p role="status" className="source-status">
          正在依序取得本次研究資料，原結果暫時隱藏。
        </p>
      ) : error ? (
        <section className="error-state" role="alert">
          <h2>研究資料無法取得</h2>
          <p>{error}</p>
        </section>
      ) : (
        response && (
          <>
            {!response.complete && (
              <p className="form-error" role="alert">
                本次研究資料尚不完整，以下保留本次成功取得的區塊。
              </p>
            )}
            <section className="section" aria-labelledby="history-heading">
              <h2 id="history-heading">歷史日 K 與均線</h2>
              <SourceResult result={response.history}>
                {(points) => (
                  <>
                    <TechnicalResearch
                      points={points}
                      key={`${code}/${start}/${end}`}
                    />
                    <details>
                      <summary>查看日線與均線明細</summary>
                      <div
                        className="table-scroll"
                        tabIndex={0}
                        role="region"
                        aria-label="日線明細，可橫向捲動"
                      >
                        <table className="source-table">
                          <caption>
                            原始股價（元）、成交股數與成交金額（元）；指標四捨五入至小數四位，缺值以
                            — 表示
                          </caption>
                          <thead>
                            <tr>
                              {[
                                '日期',
                                '開盤欄',
                                '最高',
                                '最低',
                                '收盤',
                                '成交股數',
                                '成交金額',
                                'MA20',
                                'MA60',
                                'RSI14',
                                'MACD',
                                'MACD 訊號線',
                                'MACD 柱狀值',
                                '布林中軌',
                                '布林上軌',
                                '布林下軌',
                              ].map((h) => (
                                <th scope="col" key={h}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[...points].reverse().map((p) => (
                              <tr key={p.date}>
                                <th scope="row">{p.date}</th>
                                {[
                                  p.price_available ? p.open : null,
                                  p.price_available ? p.high : null,
                                  p.price_available ? p.low : null,
                                  p.price_available ? p.close : null,
                                  p.volume,
                                  p.amount,
                                  p.ma20,
                                  p.ma60,
                                  p.rsi14,
                                  p.macd,
                                  p.macd_signal,
                                  p.macd_histogram,
                                  p.bollinger_middle,
                                  p.bollinger_upper,
                                  p.bollinger_lower,
                                ].map((v, i) => (
                                  <td key={i}>{valueLabel(v)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </>
                )}
              </SourceResult>
            </section>
            <section className="section" aria-labelledby="revenue-heading">
              <h2 id="revenue-heading">月營收與成長率</h2>
              <p className="source-note">
                依營收年月排列；來源紀錄日期與收錄日期不等同公司正式公告時間。缺少比較月份或前期營收不大於零時，不顯示成長率。
              </p>
              <SourceResult result={response.revenue}>
                {(points) => (
                  <>
                    <RevenueResearch
                      points={points}
                      key={`${code}/${start}/${end}`}
                    />
                    <details>
                      <summary>查看月營收明細</summary>
                      <div
                        className="table-scroll"
                        tabIndex={0}
                        role="region"
                        aria-label="月營收明細，可橫向捲動"
                      >
                        <table className="source-table">
                          <caption>
                            月營收單位：新台幣元；年增／月增率：%
                          </caption>
                          <thead>
                            <tr>
                              {[
                                '營收年月',
                                '營收',
                                '年增率',
                                '月增率',
                                '年初累計營收',
                                '累計年增率',
                                '近 12 個月營收',
                                '近 12 個月年增率',
                                '來源紀錄日期',
                                'FinMind 收錄日期',
                              ].map((h) => (
                                <th key={h} scope="col">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[...points].reverse().map((p) => (
                              <tr key={p.month}>
                                <th scope="row">{p.month}</th>
                                {[
                                  p.revenue,
                                  p.yoy,
                                  p.mom,
                                  p.ytd_revenue,
                                  p.ytd_yoy,
                                  p.trailing12_revenue,
                                  p.trailing12_yoy,
                                  p.record_date,
                                  p.recorded_at,
                                ].map((v, i) => (
                                  <td key={i}>{valueLabel(v)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </>
                )}
              </SourceResult>
            </section>
            <section className="section" aria-labelledby="institutions-heading">
              <h2 id="institutions-heading">法人買賣超</h2>
              <SourceResult result={response.institutions}>
                {(points) => (
                  <Institutions
                    points={points}
                    key={`${code}/${start}/${end}`}
                  />
                )}
              </SourceResult>
            </section>
          </>
        )
      )}
    </>
  )
}
