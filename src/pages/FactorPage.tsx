import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FactorFields } from '../components/LabForms'
import { ResearchHeading } from '../components/ResearchTools'
import { useAuth } from '../features/auth/AuthProvider'
import {
  labRequest,
  defaultScreen,
  instrumentPath,
  message,
  metrics,
  parseRefs,
  type FactorQuery,
  type FactorResult,
} from '../services/lab'

export function FactorPage() {
  const [query, setQuery] = useState<FactorQuery>(defaultScreen)
  const [result, setResult] = useState<FactorResult | null>(null)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [name, setName] = useState(''),
    [notice, setNotice] = useState('')
  const operation = useRef<AbortController | null>(null),
    pending = useRef(false)
  const { state, store } = useAuth()
  useEffect(() => () => operation.current?.abort(), [])
  async function run(form: HTMLFormElement) {
    if (pending.current) return
    pending.current = true
    const controller = new AbortController()
    operation.current = controller
    setBusy(true)
    setResult(null)
    setError('')
    setNotice('')
    try {
      const next = {
        ...query,
        instruments: parseRefs(
          String(new FormData(form).get('candidates') ?? ''),
        ),
      }
      setQuery(next)
      setResult(
        await labRequest<FactorResult>(
          '/research/factors',
          controller.signal,
          'POST',
          next,
        ),
      )
    } catch (e) {
      if (!controller.signal.aborted) setError(message(e))
    } finally {
      pending.current = false
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  async function save() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await store.privateRequest((signal) =>
        labRequest('/workspace/items', signal, 'POST', {
          document: { kind: 'screen', name, query },
        }),
      )
      setNotice('已儲存篩選條件，可到研究工作區重新執行。')
    } catch (e) {
      setError(message(e))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <>
      <ResearchHeading
        title="基本面與籌碼選股"
        description="指定最多 10 檔候選，依序查詢營收、財報比率與法人連買。空白門檻不查詢該項。"
      />
      <form
        className="search-form lab-form"
        onSubmit={(e) => {
          e.preventDefault()
          void run(e.currentTarget)
        }}
      >
        <fieldset disabled={busy}>
          <FactorFields value={query} onChange={setQuery} />
          <button className="button">執行候選篩選</button>
        </fieldset>
      </form>
      <p className="source-note">
        這是候選清單篩選。資料期間不等於公告時間；財報可能重編，不可當作歷史時點選股回測。法人連買依來源有資料的日期計數。
      </p>
      {busy && <p role="status">正在依序處理本次查詢…</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {result && !busy && (
        <>
          <p>{result.note}</p>
          {!result.complete && (
            <p role="alert">
              部分候選資料不足、來源失敗或未完成查詢；以下分別標示。
            </p>
          )}
          <div className="table-scroll">
            <table className="source-table">
              <thead>
                <tr>
                  <th>證券</th>
                  <th>結果</th>
                  {Object.values(metrics).map((n) => (
                    <th key={n}>{n}</th>
                  ))}
                  <th>資料期間／錯誤</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={`${r.market}:${r.code}`}>
                    <th>
                      <Link to={instrumentPath(r)}>
                        {r.market}:{r.code} {r.name}
                      </Link>
                    </th>
                    <td>
                      {r.matches === true
                        ? '符合'
                        : r.matches === false
                          ? '不符合'
                          : r.status === 'insufficient'
                            ? '資料不足'
                            : r.status === 'error'
                              ? '來源錯誤'
                              : '未完成查詢'}
                    </td>
                    {Object.keys(metrics).map((key) => (
                      <td key={key}>
                        {r.metrics[key as keyof typeof metrics] ?? '—'}
                      </td>
                    ))}
                    <td>
                      {r.error?.message ?? Object.values(r.dates).join('、')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {state.status === 'authenticated' ? (
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <label>
            篩選條件名稱
            <input
              value={name}
              maxLength={100}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="button" disabled={busy}>
            儲存目前條件
          </button>
          <Link to="/workspace">開啟研究工作區</Link>
        </form>
      ) : (
        <p>
          <Link to="/login?next=%2Fresearch%2Ffactors">登入後儲存篩選條件</Link>
        </p>
      )}
    </>
  )
}
