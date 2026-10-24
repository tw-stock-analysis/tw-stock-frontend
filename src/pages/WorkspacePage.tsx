import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { ResearchHeading } from '../components/ResearchTools'
import { FactorFields, InstrumentFields } from '../components/LabForms'
import { taipeiDate } from '../services/analysis'
import {
  labRequest,
  message,
  defaultScreen,
  formatRefs,
  parseRefs,
  instrumentPath,
  type Document,
  type Kind,
  type LedgerEntry,
  type WorkspaceItem,
  type Valuation,
  type FactorResult,
} from '../services/lab'
import { FactorResults } from './WorkspaceResults'

const kinds: Record<Kind, string> = {
  note: '研究筆記',
  screen: '篩選條件',
  chart: '圖表偏好',
  comparison: '命名比較組合',
  portfolio: '投資組合帳本',
}
function newDocument(kind: Kind): Document {
  const instrument = { market: 'TWSE' as const, code: '2330' }
  if (kind === 'note') return { kind, name: '', instrument, body: '' }
  if (kind === 'screen') return { kind, name: '', query: defaultScreen() }
  if (kind === 'chart')
    return {
      kind,
      name: '',
      instrument,
      overlay: 'ma',
      indicator: 'rsi',
      days: 180,
    }
  if (kind === 'comparison')
    return {
      kind,
      name: '',
      instruments: [instrument, { market: 'TPEX', code: '6488' }],
    }
  return { kind, name: '', ledger: [] }
}

function LedgerEditor({
  value,
  onChange,
}: {
  value: LedgerEntry[]
  onChange: (value: LedgerEntry[]) => void
}) {
  const [entry, setEntry] = useState<LedgerEntry>({
    market: 'TWSE',
    code: '2330',
    kind: 'buy',
    date: taipeiDate(),
    quantity: '1000',
    price: '100',
    fees: '0',
    taxes: '0',
  })
  const [error, setError] = useState('')
  return (
    <>
      <h3>新增交易／現金股利／分割</h3>
      <div className="lab-grid">
        <InstrumentFields
          value={entry}
          onChange={(ref) => setEntry({ ...entry, ...ref })}
        />
        <label>
          類型
          <select
            aria-label="類型"
            value={entry.kind}
            onChange={(e) => {
              const kind = e.target.value as LedgerEntry['kind']
              setEntry({
                market: entry.market,
                code: entry.code,
                date: entry.date,
                kind,
                ...(kind === 'dividend'
                  ? { amount: '0' }
                  : kind === 'split'
                    ? { ratio: '2' }
                    : {
                        quantity: '1000',
                        price: '100',
                        fees: '0',
                        taxes: '0',
                      }),
              })
            }}
          >
            <option value="buy">買進</option>
            <option value="sell">賣出</option>
            <option value="dividend">現金股利收入</option>
            <option value="split">股數調整（分割／減資／配股）</option>
          </select>
        </label>
        <label>
          交易／入帳日期
          <input
            type="date"
            value={entry.date}
            min="1994-10-01"
            max={taipeiDate()}
            onChange={(e) => setEntry({ ...entry, date: e.target.value })}
          />
        </label>
        {entry.kind === 'buy' || entry.kind === 'sell' ? (
          <>
            {[
              ['quantity', '股數'],
              ['price', '單價（元）'],
              ['fees', '手續費（元）'],
              ['taxes', '交易稅（元）'],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={entry[key as 'quantity'] ?? ''}
                  onChange={(e) =>
                    setEntry({ ...entry, [key]: e.target.value })
                  }
                />
              </label>
            ))}
          </>
        ) : entry.kind === 'dividend' ? (
          <label>
            實收股利（元）
            <input
              type="number"
              min="0"
              step="any"
              value={entry.amount ?? ''}
              onChange={(e) => setEntry({ ...entry, amount: e.target.value })}
            />
          </label>
        ) : (
          <label>
            調整後股數／原股數（例如 2）
            <input
              type="number"
              min="0.00000001"
              step="any"
              value={entry.ratio ?? ''}
              onChange={(e) => setEntry({ ...entry, ratio: e.target.value })}
            />
          </label>
        )}
        <button
          type="button"
          className="text-button"
          disabled={value.length >= 500}
          onClick={() => {
            setError('')
            if (
              !/^[0-9A-Z]{4,6}$/.test(entry.code) ||
              !entry.date ||
              Object.entries(entry).some(
                ([k, v]) =>
                  [
                    'quantity',
                    'price',
                    'fees',
                    'taxes',
                    'amount',
                    'ratio',
                  ].includes(k) &&
                  (!v || !Number.isFinite(Number(v)) || Number(v) < 0),
              )
            ) {
              setError('請檢查代碼、日期及數值。')
              return
            }
            onChange([...value, { ...entry }])
          }}
        >
          加入帳本
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="source-note">
        最多 500 筆、10
        檔證券；同日交易依清單順序計算。新增後請儲存。股數調整保留總成本；需返還資本的減資請自行調整原始帳本。
      </p>
      <div className="table-scroll">
        <table className="source-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>證券</th>
              <th>類型</th>
              <th>股數／單價／股利／倍率</th>
              <th>費用／稅</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {value.map((r, i) => (
              <tr key={i}>
                <td>{r.date}</td>
                <td>
                  {r.market}:{r.code}
                </td>
                <td>
                  {
                    {
                      buy: '買進',
                      sell: '賣出',
                      dividend: '股利',
                      split: '股數調整',
                    }[r.kind]
                  }
                </td>
                <td>
                  {r.kind === 'dividend'
                    ? r.amount
                    : r.kind === 'split'
                      ? r.ratio
                      : `${r.quantity} 股 × ${r.price} 元`}
                </td>
                <td>
                  {r.fees ?? 0}／{r.taxes ?? 0}
                </td>
                <td>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      onChange(value.filter((_, index) => index !== i))
                    }
                  >
                    移除第 {i + 1} 筆
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function WorkspacePage({
  portfoliosOnly = false,
}: {
  portfoliosOnly?: boolean
}) {
  const { store } = useAuth()
  const [items, setItems] = useState<WorkspaceItem[]>([]),
    [selected, setSelected] = useState<WorkspaceItem | null>(null)
  const [document, setDocument] = useState<Document>(() =>
    newDocument(portfoliosOnly ? 'portfolio' : 'note'),
  )
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [refresh, setRefresh] = useState(0)
  const [valuation, setValuation] = useState<Valuation | null>(null),
    [factors, setFactors] = useState<FactorResult | null>(null)
  const [comparison, setComparison] = useState<
    | {
        ref: string
        price: string | null
        date: string | null
        name: string
        error?: string
      }[]
    | null
  >(null)
  const [asOf, setAsOf] = useState(taipeiDate)
  const mutation = useRef<AbortController | null>(null),
    pending = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    setBusy(true)
    setItems([])
    setError('')
    void store
      .privateRequest(
        (signal) =>
          labRequest<WorkspaceItem[]>(
            '/workspace/items' + (portfoliosOnly ? '?kind=portfolio' : ''),
            signal,
          ),
        controller.signal,
      )
      .then(setItems)
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false)
      })
    return () => controller.abort()
  }, [store, refresh, portfoliosOnly])
  useEffect(() => () => mutation.current?.abort(), [])
  async function act(operation: (signal: AbortSignal) => Promise<void>) {
    if (pending.current) return
    pending.current = true
    const controller = new AbortController()
    mutation.current = controller
    setBusy(true)
    setError('')
    setNotice('')
    setValuation(null)
    setFactors(null)
    setComparison(null)
    try {
      await store.privateRequest(operation, controller.signal)
    } catch (e) {
      if (!controller.signal.aborted) setError(message(e))
    } finally {
      pending.current = false
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  function save(form: HTMLFormElement) {
    let next = document
    try {
      if (next.kind === 'comparison')
        next = {
          ...next,
          instruments: parseRefs(
            String(new FormData(form).get('comparison') ?? ''),
          ),
        }
      if (next.kind === 'screen')
        next = {
          ...next,
          query: {
            ...next.query,
            instruments: parseRefs(
              String(new FormData(form).get('candidates') ?? ''),
            ),
          },
        }
    } catch (e) {
      setError(message(e))
      return
    }
    const draft = next
    void act(async (signal) => {
      const item = await labRequest<WorkspaceItem>(
        selected ? `/workspace/items/${selected.id}` : '/workspace/items',
        signal,
        selected ? 'PUT' : 'POST',
        { document: draft, ...(selected ? { version: selected.version } : {}) },
      )
      signal.throwIfAborted()
      setSelected(item)
      setDocument(item.document)
      setNotice('已儲存。')
      setRefresh((v) => v + 1)
    })
  }
  function open(item: WorkspaceItem | null, kind: Kind = document.kind) {
    setSelected(item)
    setDocument(item ? item.document : newDocument(kind))
    setError('')
    setNotice('')
    setValuation(null)
    setFactors(null)
    setComparison(null)
  }
  async function research(signal: AbortSignal) {
    if (!selected) return
    const saved = selected.document
    if (saved.kind === 'portfolio')
      setValuation(
        await labRequest<Valuation>(
          `/workspace/items/${selected.id}/valuation?as_of=${asOf}`,
          signal,
        ),
      )
    if (saved.kind === 'screen')
      setFactors(
        await labRequest<FactorResult>(
          '/research/factors',
          signal,
          'POST',
          saved.query,
        ),
      )
    if (saved.kind === 'comparison') {
      const results = []
      for (const ref of saved.instruments) {
        signal.throwIfAborted()
        try {
          const result = await labRequest<{
            instrument: { name: string }
            prices: {
              status: string
              data: { date: string; close: string | null }[] | null
              error?: { message: string }
            }
          }>(
            `/instruments/${ref.market}/${ref.code}?start_date=${new Date(Date.parse(asOf + 'T00:00:00Z') - 30 * 86400000).toISOString().slice(0, 10)}&end_date=${asOf}`,
            signal,
          )
          const point = result.prices.data
            ?.filter((r) => r.close !== null)
            .at(-1)
          results.push({
            ref: `${ref.market}:${ref.code}`,
            name: result.instrument.name,
            price: point?.close ?? null,
            date: point?.date ?? null,
            ...(result.prices.status !== 'ok'
              ? { error: result.prices.error?.message ?? '資料缺漏' }
              : {}),
          })
        } catch (e) {
          signal.throwIfAborted()
          results.push({
            ref: `${ref.market}:${ref.code}`,
            name: '',
            price: null,
            date: null,
            error: message(e),
          })
        }
      }
      setComparison(results)
    }
  }
  const chart = document.kind === 'chart' ? document : null
  const chartURL =
    chart && Number.isFinite(Date.parse(asOf + 'T00:00:00Z'))
      ? `${instrumentPath(chart.instrument)}/history?${new URLSearchParams({ start_date: new Date(Date.parse(asOf + 'T00:00:00Z') - (chart.days - 1) * 86400000).toISOString().slice(0, 10), end_date: asOf, overlay: chart.overlay, indicator: chart.indicator })}`
      : ''
  return (
    <>
      <ResearchHeading
        title={portfoliosOnly ? '投資組合與損益' : '個人研究工作區'}
        description="保存研究條件、筆記、圖表偏好、命名比較與手動帳本。行情與查詢結果不會儲存。"
      />
      <nav className="research-nav">
        <Link to="/workspace">全部研究文件</Link>
        <Link to="/portfolio">投資組合帳本</Link>
      </nav>
      {busy && <p role="status">正在處理…</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="workspace-layout">
        <aside>
          <h2>已儲存文件</h2>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              open(null)
              setRefresh((v) => v + 1)
            }}
          >
            重新載入清單與建立空白文件
          </button>
          {items.length === 0 && !busy && <p>目前沒有研究文件。</p>}
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => open(item)}
                >
                  {item.name} · {kinds[item.kind]}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section>
          <h2>{selected ? '編輯文件' : '新增文件'}</h2>
          <form
            className="lab-form"
            key={selected?.id ?? document.kind}
            onSubmit={(e) => {
              e.preventDefault()
              save(e.currentTarget)
            }}
          >
            <fieldset disabled={busy}>
              <label>
                文件類型
                <select
                  aria-label="文件類型"
                  value={document.kind}
                  disabled={!!selected || portfoliosOnly}
                  onChange={(e) => open(null, e.target.value as Kind)}
                >
                  {Object.entries(kinds).map(([k, n]) => (
                    <option key={k} value={k}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                文件名稱
                <input
                  value={document.name}
                  maxLength={100}
                  required
                  onChange={(e) =>
                    setDocument({ ...document, name: e.target.value })
                  }
                />
              </label>
              {'instrument' in document && (
                <InstrumentFields
                  value={document.instrument}
                  onChange={(instrument) =>
                    setDocument({ ...document, instrument })
                  }
                />
              )}{' '}
              {document.kind === 'note' && (
                <label>
                  研究內容
                  <textarea
                    rows={12}
                    maxLength={10000}
                    aria-label="研究內容"
                    value={document.body}
                    onChange={(e) =>
                      setDocument({ ...document, body: e.target.value })
                    }
                  />
                </label>
              )}
              {document.kind === 'screen' && (
                <FactorFields
                  value={document.query}
                  onChange={(query) => setDocument({ ...document, query })}
                />
              )}{' '}
              {document.kind === 'comparison' && (
                <label>
                  比較證券（2–4 檔，每行市場:代碼）
                  <textarea
                    name="comparison"
                    aria-label="比較證券（2–4 檔，每行市場:代碼）"
                    rows={4}
                    defaultValue={formatRefs(document.instruments)}
                    required
                  />
                </label>
              )}
              {chart && (
                <>
                  <label>
                    主圖
                    <select
                      aria-label="主圖"
                      value={chart.overlay}
                      onChange={(e) =>
                        setDocument({
                          ...chart,
                          overlay: e.target.value as 'ma' | 'bollinger',
                        })
                      }
                    >
                      <option value="ma">均線</option>
                      <option value="bollinger">布林通道</option>
                    </select>
                  </label>
                  <label>
                    副圖
                    <select
                      aria-label="副圖"
                      value={chart.indicator}
                      onChange={(e) =>
                        setDocument({
                          ...chart,
                          indicator: e.target.value as 'rsi' | 'macd',
                        })
                      }
                    >
                      <option value="rsi">RSI</option>
                      <option value="macd">MACD</option>
                    </select>
                  </label>
                  <label>
                    觀察天數
                    <input
                      type="number"
                      min="1"
                      max="366"
                      value={chart.days}
                      onChange={(e) =>
                        setDocument({ ...chart, days: Number(e.target.value) })
                      }
                    />
                  </label>
                </>
              )}
              {document.kind === 'portfolio' && (
                <LedgerEditor
                  value={document.ledger}
                  onChange={(ledger) => setDocument({ ...document, ledger })}
                />
              )}
              <button className="button">
                {selected ? '儲存修改' : '建立文件'}
              </button>
              {selected && (
                <>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => open(null)}
                  >
                    建立另一份文件
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      void act(async (signal) => {
                        await labRequest(
                          `/workspace/items/${selected.id}?version=${selected.version}`,
                          signal,
                          'DELETE',
                        )
                        open(null)
                        setNotice('已刪除文件。')
                        setRefresh((v) => v + 1)
                      })
                    }
                  >
                    刪除此文件
                  </button>
                </>
              )}
            </fieldset>
          </form>
          {selected && (
            <p className="source-note">
              版本 {selected.version} · 最後儲存{' '}
              {new Date(selected.updated_at).toLocaleString('zh-TW')}
              ；查詢使用已儲存版本，編輯後請先儲存。
            </p>
          )}
          {(selected || chart) && (
            <div className="search-form">
              <label>
                估值／圖表／比較截止日期
                <input
                  type="date"
                  value={asOf}
                  min="1994-10-01"
                  max={taipeiDate()}
                  required
                  onChange={(e) => setAsOf(e.target.value)}
                />
              </label>
              {chart && chartURL && (
                <Link to={chartURL}>套用偏好開啟歷史圖表</Link>
              )}
              {selected &&
                ['portfolio', 'screen', 'comparison'].includes(
                  selected.kind,
                ) && (
                  <button
                    className="button"
                    disabled={busy || !asOf}
                    onClick={() => void act(research)}
                  >
                    依序查詢已儲存
                    {selected.kind === 'portfolio'
                      ? '帳本估值'
                      : selected.kind === 'screen'
                        ? '選股條件'
                        : '比較證券'}
                  </button>
                )}
              {document.kind === 'note' && (
                <Link to={instrumentPath(document.instrument)}>
                  開啟這檔證券研究
                </Link>
              )}
            </div>
          )}
        </section>
      </div>
      {!busy && (
        <FactorResults
          valuation={valuation}
          factors={factors}
          comparison={comparison}
        />
      )}
    </>
  )
}
