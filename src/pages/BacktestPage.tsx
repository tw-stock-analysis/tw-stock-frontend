import { useEffect, useRef, useState } from 'react'
import { InstrumentFields } from '../components/LabForms'
import { ResearchHeading } from '../components/ResearchTools'
import { ResearchBars } from '../components/HistoryCharts'
import { taipeiDate } from '../services/analysis'
import {
  labRequest,
  message,
  type InstrumentRef,
  type BacktestResult,
} from '../services/lab'

export function BacktestPage() {
  const [instrument, setInstrument] = useState<InstrumentRef>({
    market: 'TWSE',
    code: '2330',
  })
  const [result, setResult] = useState<BacktestResult | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const controller = useRef<AbortController | null>(null),
    pending = useRef(false)
  useEffect(() => () => controller.current?.abort(), [])
  async function run(form: HTMLFormElement) {
    if (pending.current) return
    pending.current = true
    controller.current = new AbortController()
    const signal = controller.current.signal
    setBusy(true)
    setResult(null)
    setError('')
    try {
      const data = Object.fromEntries(new FormData(form))
      setResult(
        await labRequest<BacktestResult>('/research/backtest', signal, 'POST', {
          ...data,
          instrument,
          fast: Number(data.fast),
          slow: Number(data.slow),
          lot_size: Number(data.lot_size),
        }),
      )
    } catch (e) {
      if (!signal.aborted) setError(message(e))
    } finally {
      pending.current = false
      if (!signal.aborted) setBusy(false)
    }
  }
  return (
    <>
      <ResearchHeading
        title="策略回測"
        description="單一證券買入持有或均線策略，使用前一日訊號、次一日開盤模擬成交。"
      />
      <form
        className="search-form lab-form"
        onSubmit={(e) => {
          e.preventDefault()
          void run(e.currentTarget)
        }}
      >
        <fieldset disabled={busy}>
          <InstrumentFields value={instrument} onChange={setInstrument} />
          <label>
            策略
            <select name="strategy" aria-label="策略">
              <option value="sma">短均線高於長均線時持有</option>
              <option value="buy_hold">買入持有</option>
            </select>
          </label>
          <label>
            價格基礎
            <select name="basis" aria-label="價格基礎">
              <option value="unadjusted">原始股價（不含股利）</option>
              <option value="source_adjusted">
                FinMind 還原價格（須來源權限）
              </option>
            </select>
          </label>
          <label>
            開始日期
            <input
              name="start_date"
              type="date"
              required
              defaultValue="2025-01-01"
              min="1994-10-01"
              max={taipeiDate()}
            />
          </label>
          <label>
            截止日期
            <input
              name="end_date"
              type="date"
              required
              defaultValue={taipeiDate()}
              min="1994-10-01"
              max={taipeiDate()}
            />
          </label>
          {[
            ['fast', '短均線期數', '5', '2', '60'],
            ['slow', '長均線期數', '20', '3', '120'],
            ['initial_cash', '初始資金（元）', '1000000', '1', '1000000000000'],
            ['commission_rate', '手續費率（小數）', '0.001425', '0', '1'],
            ['sell_tax_rate', '賣出交易稅率（小數）', '0.003', '0', '1'],
            ['slippage_rate', '滑價率（小數）', '0', '0', '0.99'],
            ['minimum_fee', '最低手續費（元）', '20', '0', '10000'],
          ].map(([name, label, value, min, max]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                type="number"
                step={name === 'fast' || name === 'slow' ? '1' : 'any'}
                defaultValue={value}
                min={min}
                max={max}
                required
              />
            </label>
          ))}
          <label>
            交易單位
            <select name="lot_size" aria-label="交易單位">
              <option value="1">零股（1 股）</option>
              <option value="1000">整張（1,000 股）</option>
            </select>
          </label>
          <button className="button">執行回測</button>
        </fieldset>
      </form>
      <p className="source-note">
        最多 1,830
        天；興櫃開盤欄為參考資訊，不支援成交回測。含分割／減資等事件時原始股價模式會停止，須改用還原價格。模擬不含成交量限制與漲跌停排隊。
      </p>
      {busy && <p role="status">正在依序確認證券、公司行動與歷史價格…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {result && !busy && (
        <section className="section">
          <h2>{result.instrument.name} · 回測結果</h2>
          <dl className="lab-summary">
            <div>
              <dt>期末資產（元）</dt>
              <dd>{result.final_equity}</dd>
            </div>
            <div>
              <dt>區間報酬（%）</dt>
              <dd>{result.return_percent}</dd>
            </div>
            <div>
              <dt>最大回撤（%）</dt>
              <dd>{result.max_drawdown_percent}</dd>
            </div>
            <div>
              <dt>手續費與稅（元）</dt>
              <dd>{result.fees_and_taxes}</dd>
            </div>
          </dl>
          <ResearchBars
            title="資產曲線"
            unit="元"
            points={result.equity.map((p) => ({
              date: p.date,
              value: p.equity,
            }))}
          />
          <ul>
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <details>
            <summary>成交紀錄（{result.orders.length} 筆）</summary>
            <div className="table-scroll">
              <table className="source-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>方向</th>
                    <th>股數</th>
                    <th>模擬成交價</th>
                    <th>手續費</th>
                    <th>交易稅</th>
                  </tr>
                </thead>
                <tbody>
                  {result.orders.map((r, i) => (
                    <tr key={i}>
                      <td>{r.date}</td>
                      <td>{r.side === 'buy' ? '買進' : '賣出'}</td>
                      <td>{r.quantity}</td>
                      <td>{r.price}</td>
                      <td>{r.fee}</td>
                      <td>{r.tax}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {!result.orders.length && (
            <p>本次沒有產生可成交委託，資金保持現金。</p>
          )}
        </section>
      )}
    </>
  )
}
