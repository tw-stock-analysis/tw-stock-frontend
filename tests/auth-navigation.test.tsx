// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { routes } from '../src/app/routes'
import { safeReturnPath } from '../src/features/auth/AuthProvider'

const user = {
  id: 'member',
  email: 'reader@example.test',
  display_name: '研究者',
  status: 'active',
  email_verified_at: '2026-10-21T01:00:00Z',
}
const first = {
  id: 'desktop',
  created_at: '2026-10-21T01:00:00Z',
  last_seen_at: '2026-10-21T02:00:00Z',
  expires_at: '2026-10-28T01:00:00Z',
  user_agent: 'Desktop browser',
  created_ip: '192.0.2.10',
  is_current: true,
}
const second = {
  ...first,
  id: 'phone',
  user_agent: 'Phone browser',
  is_current: false,
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const invalid = () => json({ error: { code: 'SESSION_INVALID' } }, 401)
const fetchMock = vi.fn()
const routers: ReturnType<typeof createMemoryRouter>[] = []
let authenticated = false
let devices = [first, second]

beforeEach(() => {
  authenticated = false
  devices = [first, second]
  fetchMock.mockReset().mockImplementation(async (path: string) => {
    if (path === '/api/v1/me') return authenticated ? json(user) : invalid()
    if (path === '/api/v1/auth/login') {
      authenticated = true
      return json({ user, expires_at: first.expires_at })
    }
    if (path === '/api/v1/auth/logout') {
      authenticated = false
      return new Response(null, { status: 204 })
    }
    if (path === '/api/v1/me/sessions') return json({ sessions: devices })
    if (path === '/api/v1/me/sessions/revoke-others') {
      devices = [first]
      return new Response(null, { status: 204 })
    }
    throw new Error('Unexpected request: ' + path)
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  routers.splice(0).forEach((router) => router.dispose())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  routers.push(router)
  render(<RouterProvider router={router} />)
  return router
}

async function loginForm() {
  await screen.findByRole('heading', { name: '登入台股研究室' })
  const form = screen.getByRole('form', { name: '登入帳號' })
  await waitFor(() =>
    expect(within(form).getByRole('button', { name: '登入' })).toBeEnabled(),
  )
  return form
}

function fill(form: HTMLElement, password = 'one password 密碼 ') {
  fireEvent.change(within(form).getByLabelText('Email'), {
    target: { value: user.email },
  })
  fireEvent.change(within(form).getByLabelText('密碼'), {
    target: { value: password },
  })
}

it('logs in, clears the password input, and opens the protected device page without storing credentials', async () => {
  const local = vi.spyOn(Storage.prototype, 'setItem')
  open('/login')
  const form = await loginForm()
  fill(form)
  fireEvent.submit(form)
  expect(within(form).getByLabelText('密碼')).toHaveValue('')
  await screen.findByRole('heading', { level: 1, name: '登入裝置' })
  await screen.findByRole('heading', { name: '目前裝置' })
  expect(screen.getByText('Desktop browser')).toBeInTheDocument()
  expect(screen.getByText('Phone browser')).toBeInTheDocument()
  expect(local).not.toHaveBeenCalled()
  expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
    '/api/v1/me',
    '/api/v1/auth/login',
    '/api/v1/me/sessions',
  ])
})

it('restores the user and devices on a fresh page mount via /me', async () => {
  authenticated = true
  open('/account/sessions')
  await screen.findByRole('heading', { name: '目前裝置' })
  expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
    '/api/v1/me',
    '/api/v1/me/sessions',
  ])
  expect(screen.getByRole('button', { name: '登出' })).toBeInTheDocument()
})

it('shows a generic login failure, keeps the email, and allows a corrected password', async () => {
  fetchMock
    .mockImplementationOnce(async () => invalid())
    .mockImplementationOnce(async () =>
      json(
        {
          error: {
            code: 'LOGIN_INVALID',
            message: 'must not echo raw password',
          },
        },
        401,
      ),
    )
  open('/login')
  const form = await loginForm()
  fill(form, 'wrong password')
  fireEvent.submit(form)
  await screen.findByRole('alert')
  expect(screen.getByRole('alert')).toHaveTextContent('Email 或密碼不正確')
  expect(within(form).getByLabelText('Email')).toHaveValue(user.email)
  expect(within(form).getByLabelText('密碼')).toHaveValue('')
  expect(document.body).not.toHaveTextContent('must not echo')
  fill(form)
  fireEvent.submit(form)
  await screen.findByRole('heading', { name: '目前裝置' })
})

it('does not submit a password that exceeds the backend UTF-8 byte limit', async () => {
  open('/login')
  const form = await loginForm()
  fill(form, '密'.repeat(342))
  fireEvent.submit(form)
  expect(screen.getByRole('alert')).toHaveTextContent('密碼過長')
  expect(
    fetchMock.mock.calls.some(([path]) => path === '/api/v1/auth/login'),
  ).toBe(false)
})

it('prevents repeated submissions while the first login is in flight', async () => {
  let finish: (value: Response) => void = () => {}
  fetchMock
    .mockImplementationOnce(async () => invalid())
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
  open('/login')
  const form = await loginForm()
  fill(form)
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(
    fetchMock.mock.calls.filter(([path]) => path === '/api/v1/auth/login'),
  ).toHaveLength(1)
  expect(within(form).getByRole('button', { name: '正在登入…' })).toBeDisabled()
  await act(async () => finish(json({ user, expires_at: first.expires_at })))
  await screen.findByRole('heading', { name: '目前裝置' })
})

it('redirects an anonymous device-page request to login with a safe internal return path', async () => {
  const router = open('/account/sessions')
  await loginForm()
  expect(router.state.location.pathname).toBe('/login')
  expect(new URLSearchParams(router.state.location.search).get('next')).toBe(
    '/account/sessions',
  )
  expect(
    fetchMock.mock.calls.some(([path]) => path === '/api/v1/me/sessions'),
  ).toBe(false)
})

it('revoke-others handles 204, then reloads devices and retains the current login', async () => {
  authenticated = true
  open('/account/sessions')
  await screen.findByText('Phone browser')
  fireEvent.click(screen.getByRole('button', { name: '登出其他裝置' }))
  await screen.findByText('已登出其他裝置，目前裝置保持登入。')
  await screen.findByRole('heading', { name: '目前裝置' })
  expect(screen.queryByText('Phone browser')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '登出其他裝置' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '登出' })).toBeInTheDocument()
  expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
    '/api/v1/me',
    '/api/v1/me/sessions',
    '/api/v1/me/sessions/revoke-others',
    '/api/v1/me/sessions',
  ])
})

it('logout handles 204, removes private device data, and returns to login', async () => {
  authenticated = true
  open('/account/sessions')
  await screen.findByText('Phone browser')
  fireEvent.click(screen.getByRole('button', { name: '登出' }))
  await loginForm()
  expect(screen.queryByText('Phone browser')).not.toBeInTheDocument()
  expect(screen.queryByText(user.email)).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('已登出')
})

it('a private SESSION_INVALID immediately removes identity and device data', async () => {
  authenticated = true
  open('/account/sessions')
  await screen.findByText('Phone browser')
  fetchMock.mockResolvedValueOnce(invalid())
  fireEvent.click(screen.getByRole('button', { name: '重新取得登入裝置' }))
  await loginForm()
  expect(screen.queryByText('Phone browser')).not.toBeInTheDocument()
  expect(screen.queryByText(user.email)).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('登入已失效')
})

it('does not show stale devices after a failed refresh and permits an explicit retry', async () => {
  authenticated = true
  open('/account/sessions')
  await screen.findByText('Phone browser')
  fetchMock.mockResolvedValueOnce(
    json({ error: { code: 'DEPENDENCY_UNAVAILABLE' } }, 503),
  )
  fireEvent.click(screen.getByRole('button', { name: '重新取得登入裝置' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('Phone browser')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '登出' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '重新取得登入裝置' }))
  await screen.findByText('Phone browser')
})

it('keeps the current login when logout fails and permits retry', async () => {
  authenticated = true
  open('/account/sessions')
  await screen.findByText('Phone browser')
  fetchMock.mockRejectedValueOnce(new TypeError('connection failed'))
  fireEvent.click(screen.getByRole('button', { name: '登出' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('alert')).toHaveTextContent('登出未完成')
  expect(
    screen.queryByRole('heading', { name: '登入台股研究室' }),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '登出' }))
  await loginForm()
})

it('keeps public pages usable when /me is unavailable, without automatic retries', async () => {
  fetchMock.mockResolvedValue(
    json({ error: { code: 'DEPENDENCY_UNAVAILABLE' } }, 503),
  )
  open('/watchlists/demo')
  await screen.findByRole('heading', { level: 1, name: '自選股' })
  await screen.findByRole('alert')
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('link', { name: '登入' })).toBeInTheDocument()
})

it.each([
  'https://evil.example',
  '//evil.example',
  '/\\evil.example',
  '/login',
  '/stocks/../../login',
  '/account/admin',
])('does not accept an unsafe login return path: %s', (target) => {
  expect(safeReturnPath(target)).toBe('/account/sessions')
})

it('preserves a valid internal stock query as the login return path', () => {
  expect(safeReturnPath('/stocks?q=0050&page=2')).toBe('/stocks?q=0050&page=2')
})
