import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'
import { authErrorMessage, register, verifyRegistration } from '../services/auth'

export function RegisterPage() {
  const { state } = useAuth()
  const navigate = useNavigate()
  const [verify, setVerify] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  useEffect(() => () => active.current?.abort(), [])

  if (state.status === 'authenticated') return <Navigate to="/workspace" replace />

  function showVerification(value: boolean) {
    setError('')
    setVerify(value)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (active.current) return
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') ?? '')
    if (verify && (Array.from(password).length < 12 || new TextEncoder().encode(password).length > 1024)) {
      setError('密碼至少需 12 個字元，且不得超過 1024 bytes。')
      return
    }
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setError('')
    try {
      if (verify) {
        if (passwordInput.current) passwordInput.current.value = ''
        await verifyRegistration(
          String(data.get('token') ?? '').trim(), password,
          String(data.get('display_name') ?? '').trim(), controller.signal,
        )
        void navigate('/login', { replace: true, state: { registered: true } })
      } else {
        await register(String(data.get('email') ?? '').trim(), controller.signal)
        setVerify(true)
      }
    } catch (error) {
      if (!controller.signal.aborted) setError(authErrorMessage(error))
    } finally {
      active.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return (
    <section className="auth-page">
      <div className="page-heading">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>註冊台股研究室</h1>
        <p className="muted">先驗證 Email，再設定帳號密碼。</p>
      </div>
      <form key={String(verify)} className="auth-card login-form" onSubmit={submit} aria-label="註冊帳號">
        {error && <p className="form-error" role="alert">{error}</p>}
        {verify ? (
          <>
            <p className="muted">若此信箱可註冊，會收到一組 30 分鐘內有效的驗證碼。</p>
            <label htmlFor="registration-token">驗證碼</label>
            <input id="registration-token" name="token" autoComplete="one-time-code" autoCapitalize="none"
              spellCheck={false} minLength={43} maxLength={43} required disabled={busy} />
            <label htmlFor="registration-name">顯示名稱（選填）</label>
            <input id="registration-name" name="display_name" autoComplete="nickname" maxLength={100} disabled={busy} />
            <label htmlFor="registration-password">密碼（至少 12 個字元）</label>
            <input id="registration-password" name="password" type="password" autoComplete="new-password"
              minLength={12} maxLength={1024} required disabled={busy} ref={passwordInput} />
          </>
        ) : (
          <>
            <label htmlFor="registration-email">Email</label>
            <input id="registration-email" name="email" type="email" autoComplete="email"
              maxLength={254} required disabled={busy} />
          </>
        )}
        <button className="button" type="submit" disabled={busy}>
          {busy ? '處理中…' : verify ? '完成註冊' : '索取驗證碼'}
        </button>
        <button className="text-button" type="button" disabled={busy} onClick={() => showVerification(!verify)}>
          {verify ? '重新索取驗證碼' : '我已有驗證碼'}
        </button>
      </form>
      <Link className="text-link" to="/login">已有帳號？前往登入 →</Link>
    </section>
  )
}
