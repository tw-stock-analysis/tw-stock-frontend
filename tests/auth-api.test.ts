import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  getCurrentUser,
  getSessions,
  login,
  logout,
  revokeOtherSessions,
} from '../src/services/auth'
import { AuthStore } from '../src/features/auth/store'

const user = {
  id: 'user-a',
  email: 'reader@example.test',
  display_name: 'Reader',
  status: 'active',
  email_verified_at: '2026-10-21T01:00:00Z',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const invalid = () => json({ error: { code: 'SESSION_INVALID' } }, 401)
const fetchMock = vi.fn()
const signal = () => new AbortController().signal

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('uses same-origin HttpOnly cookies and CSRF headers without handling a token in JavaScript', async () => {
  fetchMock.mockResolvedValue(
    json({ user, expires_at: '2026-10-28T01:00:00Z' }),
  )
  await login(' READER@EXAMPLE.TEST ', ' preserved password ', signal())
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/auth/login',
    expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' },
      body: JSON.stringify({
        email: 'reader@example.test',
        password: ' preserved password ',
      }),
    }),
  )
  const options = fetchMock.mock.calls[0][1]
  expect(options.headers.Authorization).toBeUndefined()
  expect(options.headers.Cookie).toBeUndefined()
})

it.each([logout, revokeOtherSessions])(
  'handles a bodyless 204 without trying to parse JSON',
  async (operation) => {
    const response = new Response(null, { status: 204 })
    const parse = vi.spyOn(response, 'json')
    fetchMock.mockResolvedValue(response)
    await operation(signal())
    expect(parse).not.toHaveBeenCalled()
    const options = fetchMock.mock.calls[0][1]
    expect(options.method).toBe('POST')
    expect(options.body).toBeUndefined()
    expect(options.headers['X-CSRF-Protection']).toBe('1')
  },
)

it('maps login errors without echoing backend messages or passwords', async () => {
  fetchMock.mockResolvedValue(
    json(
      {
        error: {
          code: 'LOGIN_INVALID',
          message: 'password=do-not-render-this',
        },
      },
      401,
    ),
  )
  await expect(
    login(user.email, 'do-not-render-this', signal()),
  ).rejects.toMatchObject({ code: 'LOGIN_INVALID', status: 401 })
  await expect(
    login(user.email, 'do-not-render-this', signal()),
  ).rejects.not.toThrow('do-not-render-this')
})

it.each([
  {},
  { ...user, status: 'disabled' },
  { ...user, email_verified_at: 'bad' },
])(
  'rejects a malformed current-user success instead of showing an authenticated UI',
  async (payload) => {
    fetchMock.mockResolvedValue(json(payload))
    await expect(getCurrentUser(signal())).rejects.toThrow('格式不正確')
  },
)

it('rejects malformed session dates without exposing an unusable private result', async () => {
  fetchMock.mockResolvedValue(
    json({ sessions: [{ id: 'one', created_at: 'bad' }] }),
  )
  await expect(getSessions(signal())).rejects.toThrow('格式不正確')
})

it('does not mistake a database outage for an anonymous user or retry automatically', async () => {
  fetchMock.mockResolvedValue(
    json({ error: { code: 'DEPENDENCY_UNAVAILABLE' } }, 503),
  )
  const store = new AuthStore()
  await store.restore()
  expect(store.getSnapshot()).toMatchObject({ status: 'error', user: null })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  store.stop()
})

it('bounds an unresponsive login and releases the busy state without retrying', async () => {
  vi.useFakeTimers()
  fetchMock.mockImplementation(
    (_path: string, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        )
      }),
  )
  const store = new AuthStore()
  const pending = expect(
    store.login(user.email, 'password'),
  ).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' })
  await vi.advanceTimersByTimeAsync(15_000)
  await pending
  expect(store.getSnapshot()).toMatchObject({ status: 'anonymous', busy: null })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  store.stop()
})

it('restores a user from /me and treats an absent session as a normal guest', async () => {
  const store = new AuthStore()
  fetchMock.mockResolvedValueOnce(json(user)).mockResolvedValueOnce(invalid())
  await store.restore()
  expect(store.getSnapshot()).toMatchObject({ status: 'authenticated', user })
  await store.restore()
  expect(store.getSnapshot()).toMatchObject({
    status: 'anonymous',
    user: null,
    feedback: null,
  })
  store.stop()
})

it('ignores a delayed bootstrap response after a newer login succeeds', async () => {
  let finish: (response: Response) => void = () => {}
  fetchMock.mockImplementation((path: string) =>
    path === '/api/v1/me'
      ? new Promise<Response>((resolve) => {
          finish = resolve
        })
      : Promise.resolve(json({ user, expires_at: '2026-10-28T01:00:00Z' })),
  )
  const store = new AuthStore()
  const restoring = store.restore()
  await store.login(user.email, 'password')
  finish(invalid())
  await restoring
  expect(store.getSnapshot()).toMatchObject({ status: 'authenticated', user })
  store.stop()
})

it('clears private identity and cancels other private work when SESSION_INVALID arrives', async () => {
  fetchMock.mockResolvedValue(json(user))
  const store = new AuthStore()
  await store.restore()
  let pendingSignal: AbortSignal | undefined
  let finish: (value: string) => void = () => {}
  const pending = store.privateRequest((signal) => {
    pendingSignal = signal
    return new Promise<string>((resolve) => {
      finish = resolve
    })
  })
  const stale = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  fetchMock.mockResolvedValue(invalid())
  await expect(store.privateRequest(getSessions)).rejects.toMatchObject({
    code: 'SESSION_INVALID',
  })
  expect(store.getSnapshot()).toMatchObject({
    status: 'anonymous',
    user: null,
  })
  expect(pendingSignal?.aborted).toBe(true)
  finish('private data')
  await stale
  store.stop()
})

it('a stale private 401 cannot clear a newer user identity', async () => {
  const store = new AuthStore()
  fetchMock.mockResolvedValueOnce(json(user))
  await store.restore()
  let finish: (response: Response) => void = () => {}
  fetchMock.mockReturnValueOnce(
    new Promise<Response>((resolve) => {
      finish = resolve
    }),
  )
  const oldRequest = store.privateRequest(getSessions)
  const ignored = expect(oldRequest).rejects.toMatchObject({
    name: 'AbortError',
  })
  const nextUser = { ...user, id: 'user-b', email: 'other@example.test' }
  fetchMock.mockResolvedValueOnce(
    json({ user: nextUser, expires_at: '2026-10-28T01:00:00Z' }),
  )
  await store.login(nextUser.email, 'password')
  finish(invalid())
  await ignored
  expect(store.getSnapshot()).toMatchObject({
    status: 'authenticated',
    user: nextUser,
  })
  store.stop()
})

it('a failed logout preserves the user and reports that logout did not complete', async () => {
  fetchMock
    .mockResolvedValueOnce(json(user))
    .mockRejectedValueOnce(new TypeError('secret connection details'))
  const store = new AuthStore()
  await store.restore()
  await store.logout()
  expect(store.getSnapshot()).toMatchObject({
    status: 'authenticated',
    user,
    busy: null,
  })
  expect(store.getSnapshot().feedback?.message).toContain('登出未完成')
  expect(store.getSnapshot().feedback?.message).not.toContain('secret')
  store.stop()
})

it('does not allow a pending session result to restore private data after logout', async () => {
  fetchMock.mockResolvedValueOnce(json(user))
  const store = new AuthStore()
  await store.restore()
  let finish: (value: string) => void = () => {}
  const oldRequest = store.privateRequest(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve
      }),
  )
  const ignored = expect(oldRequest).rejects.toMatchObject({
    name: 'AbortError',
  })
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
  await store.logout()
  finish('old private data')
  await ignored
  expect(store.getSnapshot()).toMatchObject({
    status: 'anonymous',
    user: null,
  })
  store.stop()
})

it('leaves an authenticated user intact after a normal private-service failure', async () => {
  fetchMock.mockResolvedValueOnce(json(user))
  const store = new AuthStore()
  await store.restore()
  fetchMock.mockResolvedValueOnce(
    json({ error: { code: 'DEPENDENCY_UNAVAILABLE' } }, 503),
  )
  await expect(store.privateRequest(getSessions)).rejects.toMatchObject({
    status: 503,
  })
  expect(store.getSnapshot()).toMatchObject({ status: 'authenticated', user })
  store.stop()
})
