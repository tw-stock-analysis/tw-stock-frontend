import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider'

export function AuthControls() {
  const { state, store } = useAuth()
  const { pathname, search } = useLocation()
  return (
    <nav className="account-nav" aria-label="帳號導覽">
      {state.status === 'checking' ? (
        <span role="status">確認登入中…</span>
      ) : state.status === 'authenticated' ? (
        <>
          <span className="account-name" title={state.user?.email}>
            {state.user?.display_name || state.user?.email}
          </span>
          <Link to="/account/sessions">登入裝置</Link>
          <button
            className="text-button"
            disabled={!!state.busy}
            onClick={() => void store.logout()}
          >
            {state.busy === 'logout' ? '正在登出…' : '登出'}
          </button>
        </>
      ) : (
        <>
          {state.status === 'error' && (
            <button
              className="text-button"
              onClick={() => void store.restore()}
            >
              重新確認登入狀態
            </button>
          )}
          <Link
            to={
              pathname === '/login'
                ? '/login'
                : '/login?next=' + encodeURIComponent(pathname + search)
            }
          >
            登入
          </Link>
        </>
      )}
    </nav>
  )
}
