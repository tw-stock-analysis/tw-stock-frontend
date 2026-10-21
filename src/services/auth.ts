export interface User {
  id: string
  email: string
  display_name: string | null
  status: 'active'
  email_verified_at: string
}

export interface LoginResult {
  user: User
  expires_at: string
}

export interface AuthSession {
  id: string
  created_at: string
  last_seen_at: string
  expires_at: string
  user_agent: string | null
  created_ip: string | null
  is_current: boolean
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code?: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

const messages: Record<string, string> = {
  LOGIN_INVALID: 'Email 或密碼不正確，或帳號尚未完成驗證、無法登入。',
  SESSION_INVALID: '登入已失效，請重新登入。',
  LOGIN_RATE_LIMITED: '登入嘗試過於頻繁，請稍後再試。',
  CSRF_REJECTED: '目前無法完成操作，請重新整理頁面後再試。',
  JSON_REQUIRED: '目前無法完成操作，請重新整理頁面後再試。',
  VALIDATION_ERROR: '輸入格式不正確，請確認 Email 與密碼長度。',
  BODY_TOO_LARGE: '輸入內容過長，請確認後再試。',
  PASSWORD_SERVICE_BUSY: '登入服務忙碌中，請稍後再試。',
  AUTH_CAPACITY_EXCEEDED: '登入服務忙碌中，請稍後再試。',
  DEPENDENCY_UNAVAILABLE: '帳號服務暫時無法使用，請稍後再試。',
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function date(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function user(value: unknown): value is User {
  return (
    object(value) &&
    typeof value.id === 'string' &&
    typeof value.email === 'string' &&
    nullableString(value.display_name) &&
    value.status === 'active' &&
    date(value.email_verified_at)
  )
}

function session(value: unknown): value is AuthSession {
  return (
    object(value) &&
    typeof value.id === 'string' &&
    date(value.created_at) &&
    date(value.last_seen_at) &&
    date(value.expires_at) &&
    nullableString(value.user_agent) &&
    nullableString(value.created_ip) &&
    typeof value.is_current === 'boolean'
  )
}

function invalidResponse(): never {
  throw new AuthError('帳號服務回應格式不正確，請稍後再試。')
}

async function request(
  path: string,
  method: 'GET' | 'POST',
  signal: AbortSignal,
  body?: { email: string; password: string },
): Promise<unknown> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal.aborted) controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, 15_000)
  try {
    const response = await fetch('/api/v1' + path, {
      method,
      signal: controller.signal,
      credentials: 'same-origin',
      cache: 'no-store',
      ...(method === 'POST'
        ? {
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Protection': '1',
            },
          }
        : {}),
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (controller.signal.aborted)
      throw new DOMException('Request cancelled', 'AbortError')
    // Logout and revoke-others deliberately return no JSON and accept no body.
    if (response.status === 204 && response.ok) return undefined
    const payload: unknown = await response.json().catch((error) => {
      if (controller.signal.aborted) throw error
      return null
    })
    if (controller.signal.aborted)
      throw new DOMException('Request cancelled', 'AbortError')
    if (!response.ok) {
      const detail =
        object(payload) && object(payload.error) ? payload.error : null
      const code = typeof detail?.code === 'string' ? detail.code : undefined
      throw new AuthError(
        (code && messages[code]) || '帳號服務暫時無法完成操作，請稍後再試。',
        response.status,
        code,
      )
    }
    return payload
  } catch (error) {
    if (signal.aborted)
      throw new DOMException('Request cancelled', 'AbortError')
    if (timedOut)
      throw new AuthError(
        '帳號服務回應逾時，請稍後再試。',
        0,
        'REQUEST_TIMEOUT',
      )
    if (error instanceof AuthError) throw error
    throw new AuthError('無法連線至帳號服務，請確認網路後再試。')
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export function isSessionInvalid(error: unknown): boolean {
  return (
    error instanceof AuthError &&
    error.status === 401 &&
    error.code === 'SESSION_INVALID'
  )
}

export function authErrorMessage(error: unknown): string {
  return error instanceof AuthError
    ? error.message
    : '目前無法完成操作，請稍後再試。'
}

export async function getCurrentUser(signal: AbortSignal): Promise<User> {
  const result = await request('/me', 'GET', signal)
  return user(result) ? result : invalidResponse()
}

export async function login(
  email: string,
  password: string,
  signal: AbortSignal,
): Promise<LoginResult> {
  const result = await request('/auth/login', 'POST', signal, {
    email: email.trim().toLowerCase(),
    password,
  })
  return object(result) && user(result.user) && date(result.expires_at)
    ? { user: result.user, expires_at: result.expires_at }
    : invalidResponse()
}

export async function logout(signal: AbortSignal): Promise<void> {
  const result = await request('/auth/logout', 'POST', signal)
  if (result !== undefined) invalidResponse()
}

export async function getSessions(signal: AbortSignal): Promise<AuthSession[]> {
  const result = await request('/me/sessions', 'GET', signal)
  return object(result) &&
    Array.isArray(result.sessions) &&
    result.sessions.every(session)
    ? result.sessions
    : invalidResponse()
}

export async function revokeOtherSessions(signal: AbortSignal): Promise<void> {
  const result = await request('/me/sessions/revoke-others', 'POST', signal)
  if (result !== undefined) invalidResponse()
}
