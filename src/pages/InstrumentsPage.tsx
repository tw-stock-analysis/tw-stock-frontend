import {
  Form,
  Link,
  useLoaderData,
  type LoaderFunctionArgs,
} from 'react-router-dom'
import { ResearchHeading } from '../components/ResearchTools'
import {
  labRequest,
  markets,
  instrumentPath,
  type Instrument,
} from '../services/lab'
import { taipeiDate } from '../services/analysis'

export async function loadInstruments({ request, params }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  if (params.code) {
    return {
      detail: await labRequest<{
        instrument: Instrument
        prices: {
          status: string
          data: { date: string; close: string | null }[] | null
          error?: { message: string }
          meta?: { retrieved_at: string } | null
        }
        note: string
      }>(
        `/instruments/${params.market}/${params.code}?${url.searchParams}`,
        request.signal,
      ),
      query: Object.fromEntries(url.searchParams),
    }
  }
  return {
    search: await labRequest<{
      data: Instrument[]
      pagination: { page: number; limit: number; total: number }
    }>(`/instruments?${url.searchParams}`, request.signal),
    query: Object.fromEntries(url.searchParams),
  }
}
export function InstrumentsPage() {
  const data = useLoaderData() as Awaited<ReturnType<typeof loadInstruments>>
  if (data.detail) {
    const { instrument, prices, note } = data.detail
    return (
      <>
        <ResearchHeading
          title={`${instrument.name} · ${instrument.market}:${instrument.code}`}
          description="多市場來源參考、歷史紀錄與區間收盤價。"
        />
        <p className="source-note">
          {note} {instrument.note}
        </p>
        <nav className="research-nav">
          <Link to="/instruments">返回證券名錄</Link>
          <Link to={`${instrumentPath(instrument)}/history`}>
            技術、營收與法人
          </Link>
          <Link to={`${instrumentPath(instrument)}/research/valuation`}>
            估值、股利與財報
          </Link>
        </nav>
        <section className="section">
          <h2>證券身分參考</h2>
          <p>
            名錄參考日期 {instrument.reference_date ?? '來源未提供日期'} ·
            下市櫃紀錄 {instrument.delisted_on ?? '未提供'} ·{' '}
            {instrument.industry ?? '無產業分類'}
          </p>
          <ul>
            {instrument.records.map((r, i) => (
              <li key={i}>
                {r.source_date ?? '日期未提供'} · {markets[r.market]} · {r.name}{' '}
                · {r.kind === 'delisting' ? '下市櫃紀錄' : '名錄參考'}
              </li>
            ))}
          </ul>
        </section>
        <Form method="get" className="search-form">
          <label>
            開始日期
            <input
              type="date"
              name="start_date"
              defaultValue={data.query.start_date}
              min="1994-10-01"
              max={taipeiDate()}
            />
          </label>
          <label>
            截止日期
            <input
              type="date"
              name="end_date"
              defaultValue={data.query.end_date ?? taipeiDate()}
              max={taipeiDate()}
            />
          </label>
          <button className="button">查詢收盤價</button>
        </Form>
        <section className="section">
          <h2>原始收盤價</h2>
          <p className="source-note">
            來源：
            <a
              href="https://finmindtrade.com/"
              target="_blank"
              rel="noreferrer"
            >
              FinMind
            </a>
            {prices.meta
              ? ` · 取得時間 ${new Date(prices.meta.retrieved_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}（台北）`
              : ''}
          </p>
          {prices.status === 'ok' ? (
            <div className="table-scroll">
              <table className="source-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>收盤價（元）</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(prices.data ?? [])].reverse().map((p) => (
                    <tr key={p.date}>
                      <td>{p.date}</td>
                      <td>{p.close ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!prices.data?.length && <p>本區間來源無資料。</p>}
            </div>
          ) : (
            <p role="alert">{prices.error?.message ?? '收盤價查詢失敗。'}</p>
          )}
        </section>
      </>
    )
  }
  const result = data.search!
  const page = (n: number) =>
    `?${new URLSearchParams({ ...data.query, page: String(n) })}`
  return (
    <>
      <ResearchHeading
        title="多市場證券名錄"
        description="查詢上市、上櫃、興櫃與下市櫃來源參考。每次搜尋重新取得名錄。"
      />
      <Form method="get" className="search-form">
        <label>
          市場
          <select
            name="market"
            aria-label="市場"
            defaultValue={data.query.market ?? 'ALL'}
          >
            <option value="ALL">全部市場</option>
            {Object.entries(markets).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          代碼或歷史名稱
          <input name="q" maxLength={100} defaultValue={data.query.q} />
        </label>
        <button className="button">搜尋證券</button>
      </Form>
      <p className="source-note">
        來源日期不是上市日；這份參考名錄沒有完整永久證券身分。不同名稱或身分衝突的代碼會停止研究查詢，避免混合資料。
      </p>
      <div className="table-scroll">
        <table className="source-table">
          <thead>
            <tr>
              <th>市場</th>
              <th>代碼／名稱</th>
              <th>參考日期</th>
              <th>下市櫃紀錄</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((item) => (
              <tr key={item.code}>
                <td>{markets[item.market]}</td>
                <th>
                  <Link to={instrumentPath(item)}>
                    {item.code} {item.name}
                  </Link>
                  {item.historical_identity === 'ambiguous' && '（身分衝突）'}
                </th>
                <td>{item.reference_date ?? '日期未提供'}</td>
                <td>{item.delisted_on ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        {result.pagination.total} 筆 · 第 {result.pagination.page} 頁
      </p>
      <nav className="research-nav" aria-label="名錄分頁">
        {result.pagination.page > 1 && (
          <Link to={page(result.pagination.page - 1)}>上一頁</Link>
        )}
        {result.pagination.page * result.pagination.limit <
          result.pagination.total && (
          <Link to={page(result.pagination.page + 1)}>下一頁</Link>
        )}
      </nav>
      {!result.data.length && <p>沒有符合的來源參考。</p>}
    </>
  )
}
