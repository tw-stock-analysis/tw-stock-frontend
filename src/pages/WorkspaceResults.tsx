import type { Valuation, FactorResult } from '../services/lab'
import { metrics } from '../services/lab'
export function FactorResults({
  valuation,
  factors,
  comparison,
}: {
  valuation: Valuation | null
  factors: FactorResult | null
  comparison:
    | {
        ref: string
        name: string
        price: string | null
        date: string | null
        error?: string
      }[]
    | null
}) {
  return (
    <>
      {valuation && (
        <section className="section">
          <h2>帳本損益 · 截至 {valuation.as_of}</h2>
          <p>{valuation.note}</p>
          {!valuation.complete && (
            <p role="alert">部分持股無法估值，未實現與總損益留空。</p>
          )}
          <dl className="lab-summary">
            {[
              ['已實現', valuation.realized],
              ['實收股利', valuation.dividends],
              ['未實現', valuation.unrealized],
              ['總損益', valuation.total_pnl],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}（元）</dt>
                <dd>{v ?? '—'}</dd>
              </div>
            ))}
          </dl>
          <div className="table-scroll">
            <table className="source-table">
              <thead>
                <tr>
                  {[
                    '證券',
                    '股數',
                    '剩餘成本',
                    '已實現',
                    '股利收入',
                    '行情日期',
                    '收盤價',
                    '市值',
                    '未實現',
                    '累計費稅',
                    '狀態',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {valuation.positions.map((p) => (
                  <tr key={`${p.market}:${p.code}`}>
                    <th>
                      {p.market}:{p.code}
                    </th>
                    {[
                      p.quantity,
                      p.cost,
                      p.realized,
                      p.dividends,
                      p.price_date,
                      p.last_price,
                      p.market_value,
                      p.unrealized,
                      p.fees_and_taxes,
                      p.error_message ?? (p.error ? '行情取得失敗' : '完成'),
                    ].map((v, i) => (
                      <td key={i}>{v ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {factors && (
        <section className="section">
          <h2>已儲存條件 · 本次篩選結果</h2>
          <p>{factors.note}</p>
          <div className="table-scroll">
            <table className="source-table">
              <thead>
                <tr>
                  <th>證券</th>
                  <th>結果</th>
                  {Object.values(metrics).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                  <th>來源期間／錯誤</th>
                </tr>
              </thead>
              <tbody>
                {factors.rows.map((p) => (
                  <tr key={`${p.market}:${p.code}`}>
                    <th>
                      {p.market}:{p.code} {p.name}
                    </th>
                    <td>
                      {p.matches === true
                        ? '符合'
                        : p.matches === false
                          ? '不符合'
                          : p.status === 'insufficient'
                            ? '資料不足'
                            : p.status === 'error'
                              ? '來源錯誤'
                              : '未完成查詢'}
                    </td>
                    {Object.keys(metrics).map((k) => (
                      <td key={k}>
                        {p.metrics[k as keyof typeof metrics] ?? '—'}
                      </td>
                    ))}
                    <td>
                      {p.error?.message ?? Object.values(p.dates).join('、')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {comparison && (
        <section className="section">
          <h2>命名組合 · 本次收盤比較</h2>
          <p>
            最近 30
            天最後一筆可用收盤價；不同市場／交易日可能不同，不推定為即時同時報價。
          </p>
          <div className="table-scroll">
            <table className="source-table">
              <thead>
                <tr>
                  <th>證券</th>
                  <th>名稱</th>
                  <th>來源日期</th>
                  <th>原始收盤價（元）</th>
                  <th>狀態</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((p) => (
                  <tr key={p.ref}>
                    <th>{p.ref}</th>
                    <td>{p.name}</td>
                    <td>{p.date ?? '—'}</td>
                    <td>{p.price ?? '—'}</td>
                    <td>
                      {p.error ?? (p.price === null ? '來源無價格' : '完成')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
