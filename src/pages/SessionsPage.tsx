import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../features/auth/AuthProvider'
import {
  authErrorMessage,
  getSessions,
  isAbortError,
  revokeOtherSessions,
  type AuthSession,
} from '../services/auth'

const dateFormat = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function SessionsPage() {
  const { state, store } = useAuth()
  const [sessions, setSessions] = useState<AuthSession[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const mutation = useRef<AbortController | null>(null)
  const pending = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    setSessions(null)
    setError(null)
    setLoading(true)
    void store
      .privateRequest(getSessions, controller.signal)
      .then((records) => {
        if (!controller.signal.aborted) setSessions(records)
      })
      .catch((error) => {
        if (!controller.signal.aborted && !isAbortError(error))
          setError(authErrorMessage(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [store, refresh])
  useEffect(() => () => mutation.current?.abort(), [])

  async function revoke() {
    if (pending.current || loading) return
    pending.current = true
    const controller = new AbortController()
    mutation.current = controller
    setRevoking(true)
    setSessions(null)
    setError(null)
    setNotice(null)
    try {
      await store.privateRequest(revokeOtherSessions, controller.signal)
      if (controller.signal.aborted) return
      setNotice('已登出其他裝置，目前裝置保持登入。')
      setRefresh((value) => value + 1)
    } catch (error) {
      if (!controller.signal.aborted && !isAbortError(error))
        setError(authErrorMessage(error))
    } finally {
      pending.current = false
      if (!controller.signal.aborted) setRevoking(false)
    }
  }

  return (
    <section className="sessions-page">
      <div className="page-heading">
        <p className="eyebrow">ACCOUNT SECURITY</p>
        <h1>登入裝置</h1>
        <p className="muted account-email">{state.user?.email}</p>
        <p className="muted">
          查看目前有效的登入紀錄，或登出其他裝置。時間皆為台灣時間。
        </p>
      </div>
      <div className="session-toolbar">
        <button
          className="text-button"
          disabled={loading || revoking}
          onClick={() => {
            setNotice(null)
            setRefresh((value) => value + 1)
          }}
        >
          重新取得登入裝置
        </button>
        <button
          className="button"
          disabled={
            loading || revoking || !sessions?.some((item) => !item.is_current)
          }
          onClick={() => void revoke()}
        >
          {revoking ? '正在登出其他裝置…' : '登出其他裝置'}
        </button>
      </div>
      {notice && (
        <p className="auth-feedback" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="error-state" role="alert">
          <h2>無法完成裝置操作</h2>
          <p>{error}</p>
          <p>請重新取得登入裝置後再試。</p>
        </div>
      )}
      {loading && <p role="status">正在取得登入裝置…</p>}
      {!loading && sessions?.length === 0 && (
        <p className="empty-state">目前沒有可顯示的登入紀錄，請重新取得。</p>
      )}
      {!loading && sessions && (
        <ul className="session-list" aria-label="有效登入裝置">
          {sessions.map((session, index) => (
            <li className="auth-card" key={session.id}>
              <div className="section-heading">
                <h2>
                  {session.is_current ? '目前裝置' : '其他裝置 ' + (index + 1)}
                </h2>
                {session.is_current && <span className="tag">目前登入</span>}
              </div>
              <p className="session-agent">
                {session.user_agent || '未提供瀏覽器資訊'}
              </p>
              <dl className="session-details">
                <div>
                  <dt>登入 IP</dt>
                  <dd>{session.created_ip || '未提供'}</dd>
                </div>
                <div>
                  <dt>登入時間</dt>
                  <dd>{dateFormat.format(new Date(session.created_at))}</dd>
                </div>
                <div>
                  <dt>最近活動</dt>
                  <dd>{dateFormat.format(new Date(session.last_seen_at))}</dd>
                </div>
                <div>
                  <dt>到期時間</dt>
                  <dd>{dateFormat.format(new Date(session.expires_at))}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
