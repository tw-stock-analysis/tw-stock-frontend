import { useEffect, useRef } from 'react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigation,
} from 'react-router-dom'
import { AuthControls } from '../components/AuthControls'
import { useAuth } from '../features/auth/AuthProvider'

export function App() {
  const { state: auth } = useAuth()
  const { pathname } = useLocation()
  const navigation = useNavigation()
  const main = useRef<HTMLElement>(null)
  const previousPath = useRef(pathname)

  useEffect(() => {
    if (previousPath.current !== pathname) main.current?.focus()
    previousPath.current = pathname
  }, [pathname])

  return (
    <>
      <a className="skip-link" href="#main-content">
        跳至主要內容
      </a>
      <header className="site-header">
        <div className="topbar page">
          <Link className="brand" to="/" aria-label="台股研究室首頁">
            <svg
              className="brand-mark"
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M7 23V16M16 23V9M25 23V4"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
            <span>
              台股研究室<small>TAIWAN EQUITY RESEARCH</small>
            </span>
          </Link>
          <nav className="primary-nav" aria-label="主要導覽">
            <NavLink to="/" end>
              首頁
            </NavLink>
            <NavLink to="/stocks">個股分析</NavLink>
            <NavLink to="/research">研究工具</NavLink>
            <NavLink to="/market">交易資料</NavLink>
            <NavLink to="/watchlists/demo">自選股</NavLink>
          </nav>
          <AuthControls />
        </div>
      </header>
      <main
        id="main-content"
        className="page main-content"
        tabIndex={-1}
        ref={main}
      >
        {auth.feedback && (
          <p
            className={
              'auth-feedback ' +
              (auth.feedback.kind === 'alert' ? 'form-error' : '')
            }
            role={auth.feedback.kind}
          >
            {auth.feedback.message}
          </p>
        )}
        {navigation.state !== 'idle' ? (
          <p className="page-heading" role="status">
            正在載入頁面…
          </p>
        ) : (
          <Outlet />
        )}
      </main>
      <footer className="page footer">
        <span>台股研究室 · 讓每一次研究，都有脈絡。</span>
        <span>
          資料依 TWSE／FinMind 發布頻率更新；自選股清單為示範資料。
        </span>
      </footer>
    </>
  )
}
