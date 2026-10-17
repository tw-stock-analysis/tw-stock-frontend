// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { routes } from '../src/app/routes'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderRoute(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

function navigation() {
  return within(screen.getByRole('navigation', { name: '主要導覽' }))
}

it('switches all three pages, marks only the current link, and supports browser history', async () => {
  const router = renderRoute()
  expect(navigation().getByRole('link', { name: '首頁' })).toHaveAttribute('aria-current', 'page')
  fireEvent.click(navigation().getByRole('link', { name: '個股分析' }))
  expect(await screen.findByRole('heading', { level: 1, name: '個股分析' })).toBeInTheDocument()
  expect(navigation().getByRole('link', { name: '個股分析' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(navigation().getByRole('link', { name: '首頁' })).not.toHaveAttribute('aria-current')
  expect(screen.getByRole('main')).toHaveFocus()
  fireEvent.click(navigation().getByRole('link', { name: '自選股' }))
  expect(await screen.findByRole('heading', { level: 1, name: '自選股' })).toBeInTheDocument()
  expect(navigation().getByRole('link', { name: '自選股' })).toHaveAttribute('aria-current', 'page')
  await act(() => router.navigate(-1))
  expect(screen.getByRole('heading', { level: 1, name: '個股分析' })).toBeInTheDocument()
  fireEvent.click(navigation().getByRole('link', { name: '首頁' }))
  expect(await screen.findByRole('heading', { level: 1, name: /看懂台股/ })).toBeInTheDocument()
})

it('opens stock detail directly and keeps the analysis navigation active', () => {
  renderRoute('/stocks/demo-honhai')
  expect(screen.getByRole('heading', { level: 1, name: '鴻海' })).toBeInTheDocument()
  expect(screen.getByText('198.50')).toBeInTheDocument()
  expect(screen.getByText('漲跌幅 -0.75%')).toBeInTheDocument()
  expect(navigation().getByRole('link', { name: '個股分析' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(navigation().getByRole('link', { name: '首頁' })).not.toHaveAttribute('aria-current')
})

it('searches mock data by code and name with query state in the URL', async () => {
  const router = renderRoute('/stocks?q=2330')
  expect(screen.getByRole('link', { name: /台積電 TWSE:2330/ })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /鴻海 TWSE:2317/ })).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '鴻海' } })
  fireEvent.submit(screen.getByRole('search'))
  expect(await screen.findByRole('link', { name: /鴻海 TWSE:2317/ })).toBeInTheDocument()
  expect(new URLSearchParams(router.state.location.search).get('q')).toBe('鴻海')
  fireEvent.click(screen.getByRole('link', { name: /鴻海 TWSE:2317/ }))
  expect(await screen.findByRole('heading', { level: 1, name: '鴻海' })).toBeInTheDocument()
})

it('shows an empty search state instead of unrelated stock data', () => {
  renderRoute('/stocks?q=9999')
  expect(screen.getByRole('heading', { name: '找不到符合的股票' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

it.each([
  ['/stocks/unknown', '找不到這檔股票'],
  ['/watchlists/unknown', '找不到這個頁面'],
  ['/unknown', '找不到這個頁面'],
])('handles an unknown route %s and retains the navigation', (path, heading) => {
  renderRoute(path)
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  expect(navigation().getAllByRole('link')).toHaveLength(3)
})

it('redirects the watchlists entry to the demo list without requesting the backend', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  const router = renderRoute('/watchlists')
  expect(await screen.findByRole('heading', { level: 1, name: '自選股' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/watchlists/demo')
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})
