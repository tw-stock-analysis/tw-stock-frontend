// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { routes } from '../src/app/routes'
import { parseRefs } from '../src/services/lab'

const user = {
  id: 'member',
  email: 'reader@example.test',
  display_name: '研究者',
  status: 'active',
  email_verified_at: '2026-10-21T01:00:00Z',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const invalid = () =>
  json({ error: { code: 'SESSION_INVALID', message: '登入已失效。' } }, 401)
const fetchMock = vi.fn()
const routers: ReturnType<typeof createMemoryRouter>[] = []
let authenticated = true
let documents: Record<string, unknown>[] = []
beforeEach(() => {
  authenticated = true
  documents = []
  fetchMock
    .mockReset()
    .mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/v1/me') return authenticated ? json(user) : invalid()
      if (path === '/api/v1/auth/logout') {
        authenticated = false
        return new Response(null, { status: 204 })
      }
      if (path === '/api/v1/workspace/items' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        const item = {
          id: 'saved-note',
          kind: body.document.kind,
          name: body.document.name,
          document: body.document,
          version: 1,
          updated_at: '2026-10-24T00:00:00Z',
        }
        documents.push(item)
        return json(item, 201)
      }
      if (path.startsWith('/api/v1/workspace/items') && init?.method === 'GET')
        return json(documents)
      throw new Error('Unexpected request ' + path)
    })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  routers.splice(0).forEach((r) => r.dispose())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  routers.push(router)
  render(<RouterProvider router={router} />)
  return router
}

it('parses market-qualified instruments and rejects duplicate or invalid references', () => {
  expect(parseRefs('2330\ntpex:6488')).toEqual([
    { market: 'TWSE', code: '2330' },
    { market: 'TPEX', code: '6488' },
  ])
  expect(() => parseRefs('2330,TWSE:2330')).toThrow('重複')
  expect(() => parseRefs('https://source.test')).toThrow('格式')
})
it('never loads private research documents before authentication', async () => {
  authenticated = false
  open('/workspace')
  await screen.findByRole('heading', { name: '登入台股研究室' })
  expect(
    fetchMock.mock.calls.some(([path]) =>
      String(path).includes('/workspace/items'),
    ),
  ).toBe(false)
})
it('creates a private note with a typed payload and clears it on logout', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem')
  open('/workspace')
  await screen.findByRole('heading', { name: '新增文件' })
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '建立文件' })).toBeEnabled(),
  )
  fireEvent.change(screen.getByLabelText('文件名稱'), {
    target: { value: '我的筆記' },
  })
  fireEvent.change(screen.getByLabelText('研究內容'), {
    target: { value: '私人研究內容' },
  })
  fireEvent.submit(
    screen.getByRole('button', { name: '建立文件' }).closest('form')!,
  )
  await screen.findByRole('heading', { name: '編輯文件' })
  const [, options] = fetchMock.mock.calls.find(
    ([path, init]) =>
      path === '/api/v1/workspace/items' &&
      (init as RequestInit)?.method === 'POST',
  )!
  expect(options).toMatchObject({
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' },
  })
  expect(JSON.parse(options.body)).toEqual({
    document: {
      kind: 'note',
      name: '我的筆記',
      instrument: { market: 'TWSE', code: '2330' },
      body: '私人研究內容',
    },
  })
  fireEvent.click(screen.getByRole('button', { name: '登出' }))
  await screen.findByRole('heading', { name: '登入台股研究室' })
  expect(screen.queryByDisplayValue('私人研究內容')).not.toBeInTheDocument()
  expect(storage).not.toHaveBeenCalled()
})
it('shows a version conflict without overwriting the editor', async () => {
  documents = [
    {
      id: 'existing',
      kind: 'note',
      name: '既有筆記',
      version: 3,
      updated_at: '2026-10-24T00:00:00Z',
      document: {
        kind: 'note',
        name: '既有筆記',
        instrument: { market: 'TPEX', code: '6488' },
        body: '內容',
      },
    },
  ]
  const original = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((path: string, init?: RequestInit) =>
    init?.method === 'PUT'
      ? Promise.resolve(
          json(
            {
              error: {
                code: 'WORKSPACE_VERSION_CONFLICT',
                message: '文件已被更新，請重新載入後再編輯。',
              },
            },
            409,
          ),
        )
      : original(path, init),
  )
  open('/workspace')
  fireEvent.click(
    await screen.findByRole('button', { name: '既有筆記 · 研究筆記' }),
  )
  fireEvent.change(screen.getByLabelText('研究內容'), {
    target: { value: '本機修改' },
  })
  fireEvent.submit(
    screen.getByRole('button', { name: '儲存修改' }).closest('form')!,
  )
  await screen.findByRole('alert')
  expect(screen.getByLabelText('研究內容')).toHaveValue('本機修改')
  const [, options] = fetchMock.mock.calls.find(
    ([, init]) => init?.method === 'PUT',
  )!
  expect(JSON.parse(options.body).version).toBe(3)
})
it('uses the selected market endpoint and preserves source-limited identity notes', async () => {
  const original = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((path: string, init?: RequestInit) =>
    path.startsWith('/api/v1/instruments?')
      ? Promise.resolve(
          json({
            data: [
              {
                market: 'TPEX',
                code: '6488',
                name: '上櫃測試',
                reference_date: null,
                delisted_on: null,
                historical_identity: 'source_limited',
              },
            ],
            pagination: { page: 1, limit: 20, total: 1 },
          }),
        )
      : original(path, init),
  )
  open('/instruments?market=TPEX')
  await screen.findByRole('heading', { name: '多市場證券名錄' })
  expect(screen.getByRole('link', { name: '6488 上櫃測試' })).toHaveAttribute(
    'href',
    '/instruments/TPEX/6488',
  )
  expect(
    fetchMock.mock.calls.some(
      ([path]) => path === '/api/v1/instruments?market=TPEX',
    ),
  ).toBe(true)
})
it('shows partial screening rows separately and makes exactly one explicit screening request', async () => {
  const original = fetchMock.getMockImplementation()!
  fetchMock.mockImplementation((path: string, init?: RequestInit) =>
    path === '/api/v1/research/factors'
      ? Promise.resolve(
          json({
            complete: false,
            note: '候選篩選測試',
            rows: [
              {
                market: 'TWSE',
                code: '2330',
                name: '測試',
                matches: null,
                status: 'insufficient',
                metrics: {},
                dates: {},
                error: null,
              },
            ],
          }),
        )
      : original(path, init),
  )
  open('/research/factors')
  await screen.findByRole('heading', { name: '基本面與籌碼選股' })
  fireEvent.submit(
    screen.getByRole('button', { name: '執行候選篩選' }).closest('form')!,
  )
  await screen.findByRole('cell', { name: '資料不足' })
  expect(
    fetchMock.mock.calls.filter(
      ([path]) => path === '/api/v1/research/factors',
    ),
  ).toHaveLength(1)
  await act(async () => Promise.resolve())
  expect(screen.queryByRole('cell', { name: '符合' })).not.toBeInTheDocument()
})

it('keeps chart preference editing usable when the date input is cleared', async () => {
  open('/workspace')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '建立文件' })).toBeEnabled(),
  )
  fireEvent.change(screen.getByLabelText('文件類型'), {
    target: { value: 'chart' },
  })
  const date = screen.getByLabelText('估值／圖表／比較截止日期')
  fireEvent.change(date, { target: { value: '' } })
  expect(screen.getByRole('heading', { name: '新增文件' })).toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: '套用偏好開啟歷史圖表' }),
  ).not.toBeInTheDocument()
})

it('replaces the workspace editor with an empty portfolio when navigating to the portfolio route', async () => {
  const router = open('/workspace')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '建立文件' })).toBeEnabled(),
  )
  fireEvent.change(screen.getByLabelText('文件名稱'), {
    target: { value: '未存筆記' },
  })
  await act(async () => router.navigate('/portfolio'))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '建立文件' })).toBeEnabled(),
  )
  expect(screen.getByLabelText('文件類型')).toHaveValue('portfolio')
  expect(screen.getByLabelText('文件名稱')).toHaveValue('')
})
