export interface HealthResponse {
  data: { status: 'ok' | 'ready'; service: string }
}

export async function getHealth(path: 'live' | 'ready', signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`/api/v1/health/${path}`, { signal, cache: 'no-store' })
  if (!response.ok) {
    throw new Error(path === 'ready' ? '資料庫尚未就緒，請完成資料庫啟動及遷移。' : '後端尚未連線。')
  }
  return response.json() as Promise<HealthResponse>
}
