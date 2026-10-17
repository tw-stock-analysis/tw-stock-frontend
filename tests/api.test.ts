import { afterEach, expect, it, vi } from 'vitest'
import { getHealth } from '../src/services/api'

afterEach(() => vi.unstubAllGlobals())

it('does not report a failed readiness check as connected', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })))
  await expect(getHealth('ready')).rejects.toThrow('資料庫尚未就緒')
})

it('requests health through the same origin API', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { status: 'ok', service: 'api' } })))
  vi.stubGlobal('fetch', fetchMock)
  expect((await getHealth('live')).data.status).toBe('ok')
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/health/live', expect.objectContaining({ cache: 'no-store' }))
})
