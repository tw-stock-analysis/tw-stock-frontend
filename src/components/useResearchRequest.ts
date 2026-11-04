import { useEffect, useRef, useState } from 'react'
import { AuthError } from '../services/auth'
import { message } from '../services/lab'

export function useResearchRequest<T>() {
  const [result, setResult] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const current = useRef<AbortController | null>(null)
  useEffect(() => () => current.current?.abort(), [])
  async function run(operation: (signal: AbortSignal) => Promise<T>) {
    if (current.current) return false
    const controller = new AbortController()
    current.current = controller
    setResult(null)
    setError('')
    setCancelled(false)
    setBusy(true)
    try {
      const value = await operation(controller.signal)
      if (!controller.signal.aborted && current.current === controller) {
        setResult(value)
        return true
      }
    } catch (error) {
      if (!controller.signal.aborted && current.current === controller) {
        setError(
          error instanceof AuthError && error.code === 'FINMIND_ACCESS_DENIED'
            ? '此功能所需的 FinMind 資料權限不足。請設定具相應方案權限的後端 Token，再手動重新查詢。'
            : message(error),
        )
      }
    } finally {
      if (current.current === controller) {
        current.current = null
        setBusy(false)
      }
    }
    return false
  }
  function cancel() {
    current.current?.abort()
    current.current = null
    setResult(null)
    setBusy(false)
    setCancelled(true)
  }
  return { result, error, busy, cancelled, run, cancel }
}
