// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { routes } from '../src/app/routes'
import { loadStockDetail } from '../src/services/stocks'

// Synthetic values only, not used by the application.
const quote = {
  code: '0050',
  name: '測試ETF',
  date: '1151016',
  opening_price: null,
  highest_price: '125.0',
  lowest_price: '120.0',
  closing_price: '123.4500',
  change: '0',
  trade_volume: '12345678901234567890',
  trade_value: null,
  transactions: '10',
}
const valuation = {
  code: '0050',
  name: '測試ETF',
  date: '1151015',
  pe_ratio: '22.2200',
  dividend_yield: null,
  pb_ratio: '0',
}
const margin = {
  code: '0050',
  name: '測試ETF',
  margin_balance: '0',
  short_balance: null,
  note: '',
}
const meta = {
  source: 'TWSE',
  source_url: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
  retrieved_at: '2026-10-18T16:00:00Z',
  data_date: '1151016',
  retrieval: 'on_request',
  units: 'source_native',
  note: '取得時間不代表資料日期。',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const fetchMock = vi.fn()
const routers: ReturnType<typeof createMemoryRouter>[] = []
beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async (path: string) => {
    if (path.startsWith('/api/v1/stocks?'))
      return json({
        data: [quote],
        pagination: { page: 1, limit: 20, total: 1 },
        meta,
      })
    if (path.endsWith('/valuation'))
      return json({ data: valuation, meta: { ...meta, data_date: '1151015' } })
    if (path.endsWith('/margin'))
      return json({
        data: margin,
        meta: { ...meta, data_date: null, note: '來源未提供資料日期。' },
      })
    return json({ data: quote, meta })
  })
  vi.stubGlobal('fetch', (path: string, ...args: unknown[]) =>
    path === '/api/v1/me'
      ? Promise.resolve(json({ error: { code: 'SESSION_INVALID' } }, 401))
      : fetchMock(path, ...args),
  )
})
afterEach(() => {
  cleanup()
  routers.splice(0).forEach((router) => router.dispose())
  vi.unstubAllGlobals()
})
function renderPath(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  routers.push(router)
  render(<RouterProvider router={router} />)
  return router
}

it('searches by URL and links leading-zero codes to real stock details', async () => {
  renderPath('/stocks?q=0050')
  await screen.findByRole('table')
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/stocks?q=0050&page=1&limit=20',
    expect.objectContaining({ cache: 'no-store' }),
  )
  expect(screen.getByRole('searchbox')).toHaveValue('0050')
  const link = screen.getByRole('link', { name: /測試ETF/ })
  expect(link).toHaveAttribute('href', '/stocks/0050')
  fireEvent.click(link)
  await screen.findByRole('heading', { level: 1, name: '測試ETF' })
  expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
    '/api/v1/stocks?q=0050&page=1&limit=20',
    '/api/v1/stocks/0050',
    '/api/v1/stocks/0050/valuation',
    '/api/v1/stocks/0050/margin',
  ])
})

it('preserves exact values and the distinct source dates in each detail section', async () => {
  renderPath('/stocks/0050')
  await screen.findByRole('heading', { level: 1, name: '測試ETF' })
  expect(screen.getByText('123.4500')).toBeInTheDocument()
  expect(screen.getByText('12345678901234567890')).toBeInTheDocument()
  expect(screen.getByText('資料日期：1151016')).toBeInTheDocument()
  expect(screen.getByText('資料日期：1151015')).toBeInTheDocument()
  expect(screen.getByText('資料日期：來源未提供資料日期')).toBeInTheDocument()
  expect(screen.queryByText(/假資料展示/)).not.toBeInTheDocument()
  const row = within(screen.getByRole('table')).getByRole('row', {
    name: '今日餘額 0 —',
  })
  expect(row).toBeInTheDocument()
})

it('keeps a successful current quote when an optional section fails, and continues in sequence', async () => {
  fetchMock.mockImplementation(async (path: string) =>
    path.endsWith('/valuation')
      ? json(
          {
            error: { code: 'SOURCE_RATE_LIMITED', request_id: 'value-failed' },
          },
          503,
        )
      : json({ data: path.endsWith('/margin') ? margin : quote, meta }),
  )
  renderPath('/stocks/0050')
  await screen.findByRole('heading', { level: 1, name: '測試ETF' })
  expect(screen.getByText('123.4500')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('估值資料暫時無法取得')
  expect(screen.getByRole('alert')).toHaveTextContent('value-failed')
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
    '/api/v1/stocks/0050',
    '/api/v1/stocks/0050/valuation',
    '/api/v1/stocks/0050/margin',
  ])
})

it('shows unpublished valuation and margin without inventing zeros or errors', async () => {
  fetchMock.mockImplementation(async (path: string) =>
    json({ data: path.endsWith('0050') ? quote : null, meta }),
  )
  renderPath('/stocks/0050')
  await screen.findByText('官方本次未提供此證券的估值資料。')
  expect(
    screen.getByText('官方本次未提供此證券的資券資料。'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('does not fetch optional data for an unknown quote or invalid code', async () => {
  fetchMock.mockResolvedValue(json({ error: { code: 'STOCK_NOT_FOUND' } }, 404))
  const router = renderPath('/stocks/999999')
  await screen.findByRole('heading', { level: 1, name: '找不到這個證券代碼' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await act(() => router.navigate('/stocks/invalid-code'))
  expect(
    screen.getByRole('heading', { level: 1, name: '找不到這個證券代碼' }),
  ).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('distinguishes an unavailable backend route from an unknown stock', async () => {
  fetchMock.mockResolvedValue(
    json({ error: { code: 'RESOURCE_NOT_FOUND' } }, 404),
  )
  renderPath('/stocks/0050')
  await screen.findByRole('heading', { name: '無法取得官方資料' })
  expect(
    screen.queryByRole('heading', { name: '找不到這個證券代碼' }),
  ).not.toBeInTheDocument()
})

it('refreshes all sections and removes a previous valuation after failure', async () => {
  renderPath('/stocks/0050')
  await screen.findByText('22.2200')
  fetchMock.mockImplementation(async (path: string) =>
    path.endsWith('/valuation')
      ? json({ error: { code: 'SOURCE_UNAVAILABLE' } }, 503)
      : json({
          data: path.endsWith('/margin')
            ? margin
            : { ...quote, closing_price: '124.5000' },
          meta,
        }),
  )
  fireEvent.click(screen.getByRole('button', { name: '重新取得個股資料' }))
  await screen.findByText('124.5000')
  expect(screen.queryByText('123.4500')).not.toBeInTheDocument()
  expect(screen.queryByText('22.2200')).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('估值資料暫時無法取得')
  expect(fetchMock).toHaveBeenCalledTimes(6)
})

it('clears the complete detail after a failed quote refresh', async () => {
  renderPath('/stocks/0050')
  await screen.findByText('123.4500')
  fetchMock.mockResolvedValue(
    json({ error: { code: 'SOURCE_UNAVAILABLE' } }, 503),
  )
  fireEvent.click(screen.getByRole('button', { name: '重新取得個股資料' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('123.4500')).not.toBeInTheDocument()
  expect(screen.queryByText('22.2200')).not.toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(4)
})

it('does not request subsequent sections after navigation is cancelled', async () => {
  const controller = new AbortController()
  fetchMock.mockImplementation(async () => {
    controller.abort()
    return json({ data: quote, meta })
  })
  await expect(
    loadStockDetail({
      params: { code: '0050' },
      request: new Request('http://localhost/stocks/0050', {
        signal: controller.signal,
      }),
    }),
  ).rejects.toThrow()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('keeps the search term when paging and fetches a fresh source result', async () => {
  fetchMock.mockResolvedValue(
    json({
      data: [quote],
      pagination: { page: 1, limit: 20, total: 25 },
      meta,
    }),
  )
  const router = renderPath('/stocks?q=測試')
  const next = await screen.findByRole('link', { name: '下一頁' })
  fireEvent.click(next)
  await waitFor(() => expect(router.state.location.search).toContain('page=2'))
  expect(fetchMock.mock.calls[1][0]).toContain('page=2')
  expect(
    new URL('http://localhost' + fetchMock.mock.calls[1][0]).searchParams.get(
      'q',
    ),
  ).toBe('測試')
})

it('submits a new search only when the user asks and keeps it in the URL', async () => {
  const router = renderPath('/stocks')
  await screen.findByRole('table')
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '2330' } })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fireEvent.submit(screen.getByRole('search'))
  await waitFor(() => expect(router.state.location.search).toBe('?q=2330'))
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls[1][0]).toBe(
    '/api/v1/stocks?q=2330&page=1&limit=20',
  )
})

it('hides prior details while refresh is waiting on the new quote', async () => {
  renderPath('/stocks/0050')
  await screen.findByText('123.4500')
  let finish: (response: Response) => void = () => {}
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
  )
  fireEvent.click(screen.getByRole('button', { name: '重新取得個股資料' }))
  await screen.findByRole('button', { name: '正在向 TWSE 取得…' })
  expect(screen.queryByText('123.4500')).not.toBeInTheDocument()
  expect(screen.queryByText('22.2200')).not.toBeInTheDocument()
  await act(async () =>
    finish(json({ error: { code: 'SOURCE_UNAVAILABLE' } }, 503)),
  )
  await screen.findByRole('alert')
  expect(screen.queryByText('123.4500')).not.toBeInTheDocument()
})
