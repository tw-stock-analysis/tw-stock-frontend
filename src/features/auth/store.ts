import {
  AuthError,
  authErrorMessage,
  getCurrentUser,
  isSessionInvalid,
  login,
  logout,
  type User,
} from '../../services/auth'

export interface AuthState {
  status: 'checking' | 'authenticated' | 'anonymous' | 'error'
  user: User | null
  busy: 'login' | 'logout' | null
  feedback: { kind: 'status' | 'alert'; message: string } | null
}

function cancelled(): DOMException {
  return new DOMException('Request cancelled', 'AbortError')
}

/** One provider owns this store; no credential or user state is persisted. */
export class AuthStore {
  private state: AuthState = {
    status: 'checking',
    user: null,
    busy: null,
    feedback: null,
  }
  private revision = 0
  private controllers = new Set<AbortController>()
  private listeners = new Set<() => void>()

  getSnapshot = (): AuthState => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private set(state: AuthState) {
    this.state = state
    this.listeners.forEach((listener) => listener())
  }

  private resetRequests() {
    this.revision += 1
    this.controllers.forEach((controller) => controller.abort())
    this.controllers.clear()
  }

  stop = () => {
    this.resetRequests()
  }

  private invalidSession() {
    this.resetRequests()
    this.set({
      status: 'anonymous',
      user: null,
      busy: null,
      feedback: { kind: 'status', message: '登入已失效，請重新登入。' },
    })
  }

  restore = async () => {
    if (this.state.busy) return
    this.resetRequests()
    const revision = this.revision
    const controller = new AbortController()
    this.controllers.add(controller)
    this.set({ status: 'checking', user: null, busy: null, feedback: null })
    try {
      const user = await getCurrentUser(controller.signal)
      if (revision !== this.revision || controller.signal.aborted) return
      this.set({ status: 'authenticated', user, busy: null, feedback: null })
    } catch (error) {
      if (revision !== this.revision || controller.signal.aborted) return
      this.set(
        isSessionInvalid(error)
          ? { status: 'anonymous', user: null, busy: null, feedback: null }
          : {
              status: 'error',
              user: null,
              busy: null,
              feedback: { kind: 'alert', message: authErrorMessage(error) },
            },
      )
    } finally {
      this.controllers.delete(controller)
    }
  }

  login = async (email: string, password: string) => {
    if (this.state.busy) throw new AuthError('正在處理登入操作，請稍候。')
    this.resetRequests()
    const revision = this.revision
    const controller = new AbortController()
    this.controllers.add(controller)
    this.set({
      status: 'anonymous',
      user: null,
      busy: 'login',
      feedback: null,
    })
    try {
      const result = await login(email, password, controller.signal)
      if (revision !== this.revision || controller.signal.aborted)
        throw cancelled()
      this.set({
        status: 'authenticated',
        user: result.user,
        busy: null,
        feedback: null,
      })
    } catch (error) {
      if (revision === this.revision) {
        this.set({
          status: 'anonymous',
          user: null,
          busy: null,
          feedback: null,
        })
      }
      throw error
    } finally {
      this.controllers.delete(controller)
    }
  }

  logout = async () => {
    if (this.state.busy) return
    const previous = this.state
    this.resetRequests()
    const revision = this.revision
    const controller = new AbortController()
    this.controllers.add(controller)
    this.set({ ...previous, busy: 'logout', feedback: null })
    try {
      await logout(controller.signal)
      if (revision !== this.revision || controller.signal.aborted) return
      this.set({
        status: 'anonymous',
        user: null,
        busy: null,
        feedback: { kind: 'status', message: '已登出。' },
      })
    } catch (error) {
      if (revision !== this.revision || controller.signal.aborted) return
      if (isSessionInvalid(error)) this.invalidSession()
      else
        this.set({
          ...previous,
          busy: null,
          feedback: {
            kind: 'alert',
            message: '登出未完成。' + authErrorMessage(error),
          },
        })
    } finally {
      this.controllers.delete(controller)
    }
  }

  privateRequest = async <T>(
    operation: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> => {
    if (this.state.status !== 'authenticated' || this.state.busy === 'logout')
      throw cancelled()
    const revision = this.revision
    const controller = new AbortController()
    const abort = () => controller.abort()
    if (signal?.aborted) controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    this.controllers.add(controller)
    try {
      if (controller.signal.aborted) throw cancelled()
      const result = await operation(controller.signal)
      if (revision !== this.revision || controller.signal.aborted)
        throw cancelled()
      return result
    } catch (error) {
      if (revision !== this.revision || controller.signal.aborted)
        throw cancelled()
      if (isSessionInvalid(error)) this.invalidSession()
      throw error
    } finally {
      this.controllers.delete(controller)
      signal?.removeEventListener('abort', abort)
    }
  }
}
