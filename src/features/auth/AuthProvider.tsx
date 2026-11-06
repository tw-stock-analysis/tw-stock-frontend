import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthStore } from './store'

const AuthContext = createContext<AuthStore | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new AuthStore())
  useEffect(() => {
    void store.restore()
    return store.stop
  }, [store])
  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const store = useContext(AuthContext)
  if (!store) throw new Error('AuthProvider is required')
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )
  return { state, store }
}

export function RequireAuth() {
  const { state, store } = useAuth()
  const location = useLocation()
  if (state.status === 'checking' || state.busy === 'logout') {
    return (
      <p className="page-heading" role="status">
        {state.busy === 'logout' ? '正在登出…' : '正在確認登入狀態…'}
      </p>
    )
  }
  if (state.status === 'error')
    return (
      <section className="error-state">
        <h1>暫時無法確認登入狀態</h1>
        <p>請重新取得登入狀態，或繼續瀏覽公開行情。</p>
        <button className="text-button" onClick={() => void store.restore()}>
          重新確認登入狀態
        </button>
      </section>
    )
  if (state.status !== 'authenticated') {
    return (
      <Navigate
        to={
          '/login?next=' +
          encodeURIComponent(location.pathname + location.search)
        }
        replace
      />
    )
  }
  return <Outlet />
}

export function safeReturnPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\u0000-\u0020]/.test(value)
  ) {
    return '/account/sessions'
  }
  const parsed = new URL(value, 'https://return.invalid')
  const path = parsed.pathname
  if (
    parsed.origin === 'https://return.invalid' &&
    (path === '/' ||
      path === '/account/sessions' ||
      path === '/workspace' ||
      path === '/portfolio' ||
      /^\/(stocks|market|watchlists|instruments|research)(\/|$)/.test(path))
  ) {
    return path + parsed.search + parsed.hash
  }
  return '/account/sessions'
}
