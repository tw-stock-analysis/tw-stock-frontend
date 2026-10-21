import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { safeReturnPath, useAuth } from '../features/auth/AuthProvider'
import { authErrorMessage, isAbortError } from '../services/auth'

export function LoginPage() {
  const { state, store } = useAuth()
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(false)
  const submitting = useRef(false)
  const passwordInput = useRef<HTMLInputElement>(null)
  const destination = safeReturnPath(params.get('next'))
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  if (state.status === 'authenticated')
    return <Navigate to={destination} replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || state.busy || state.status === 'checking') return
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') || '').trim()
    const password = String(data.get('password') || '')
    setError(null)
    if (!email || email.length > 254 || !password) {
      setError('請輸入有效的 Email 與密碼。')
      return
    }
    if (new TextEncoder().encode(password).length > 1024) {
      setError('密碼過長，請縮短後再試。')
      return
    }
    submitting.current = true
    // Keep the raw password out of React state, storage and error messages.
    if (passwordInput.current) passwordInput.current.value = ''
    try {
      await store.login(email, password)
    } catch (error) {
      if (mounted.current && !isAbortError(error))
        setError(authErrorMessage(error))
    } finally {
      submitting.current = false
    }
  }

  return (
    <section className="auth-page">
      <div className="page-heading">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>登入台股研究室</h1>
        <p className="muted">
          使用已完成信箱驗證的帳號登入，管理你的登入裝置。
        </p>
      </div>
      <form
        className="auth-card login-form"
        onSubmit={submit}
        aria-label="登入帳號"
      >
        {state.status === 'checking' && <p role="status">正在確認登入狀態…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          maxLength={254}
          required
          disabled={!!state.busy}
        />
        <label htmlFor="login-password">密碼</label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={1024}
          required
          disabled={!!state.busy}
          ref={passwordInput}
        />
        <button
          className="button"
          type="submit"
          disabled={!!state.busy || state.status === 'checking'}
        >
          {state.busy === 'login' ? '正在登入…' : '登入'}
        </button>
        <p className="muted auth-help">
          登入有效期為 7 天，到期後需重新登入。尚未開放公開註冊與密碼重設。
        </p>
      </form>
      <Link className="text-link" to="/stocks">
        繼續瀏覽公開行情 →
      </Link>
    </section>
  )
}
