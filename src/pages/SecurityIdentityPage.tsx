import {
  Form,
  Link,
  useLoaderData,
  useRevalidator,
  type LoaderFunctionArgs,
} from 'react-router-dom'
import { ResearchHeading } from '../components/ResearchTools'
import { taipeiDate } from '../services/analysis'
import {
  safeSourceURL,
  type IdentityEvidence,
  type SecuritySearchResult,
  type SecurityView,
} from '../services/advancedLab'
import { instrumentPath, labRequest, markets, message } from '../services/lab'

interface IdentityPageData {
  securityId: string | null
  query: Record<string, string>
  search: SecuritySearchResult | null
  detail: SecurityView | null
  error: string | null
}
export async function loadSecurityIdentity({
  params,
  request,
}: LoaderFunctionArgs): Promise<IdentityPageData> {
  const url = new URL(request.url),
    query = Object.fromEntries(url.searchParams)
  const result: IdentityPageData = {
    securityId: params.securityId ?? null,
    query,
    search: null,
    detail: null,
    error: null,
  }
  const asOf = query.as_of ?? taipeiDate()
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(asOf) ||
    !Number.isFinite(Date.parse(asOf + 'T00:00:00Z'))
  )
    return { ...result, error: '請選擇有效的身分查詢日期。' }
  if (result.securityId) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        result.securityId,
      )
    )
      return { ...result, error: '永久識別碼格式不正確。' }
  } else if (!query.code) {
    return result
  } else if (!/^[0-9A-Z]{4,6}$/.test(query.code.toUpperCase()))
    return { ...result, error: '請輸入 4–6 碼英數證券代碼。' }
  try {
    if (result.securityId)
      result.detail = await labRequest<SecurityView>(
        `/securities/${result.securityId}?${new URLSearchParams({ as_of: asOf })}`,
        request.signal,
      )
    else {
      const search = new URLSearchParams({
        ...query,
        code: query.code.toUpperCase(),
        as_of: asOf,
      })
      if (!search.get('market')) search.delete('market')
      if (!search.has('include_inactive'))
        search.set('include_inactive', 'true')
      result.search = await labRequest<SecuritySearchResult>(
        `/securities?${search}`,
        request.signal,
      )
    }
    request.signal.throwIfAborted()
    return result
  } catch (error) {
    if (request.signal.aborted) throw error
    return { ...result, error: message(error) }
  }
}
function Evidence({ value }: { value: IdentityEvidence }) {
  const href = safeSourceURL(value.source_url)
  return (
    <span className="source-note">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          {value.source_name}
        </a>
      ) : (
        value.source_name
      )}{' '}
      · 事件生效 {value.effective_date} · 查證 {value.observed_on}
    </span>
  )
}
const statusLabels = {
  verified: '已驗證',
  unknown: '資料不足，無法確認',
  ambiguous: '證券身分有衝突',
}
function SecurityTimeline({ security }: { security: SecurityView }) {
  const identity = security.market_at_as_of
  return (
    <section className="section">
      <h2>{security.name} · 證券身分</h2>
      <p className="security-id">
        永久識別碼 <code>{security.id}</code>
      </p>
      <p>
        證券類型：
        {
          { ordinary_share: '普通股', etf: 'ETF', other: '其他' }[
            security.instrument_type
          ]
        }{' '}
        · 發行人統一編號：{security.issuer_ubn ?? '來源未提供'}
      </p>
      <div
        className={
          identity.status === 'verified' ? 'identity-status' : 'error-state'
        }
        role={identity.status === 'verified' ? 'status' : 'note'}
      >
        <strong>
          {identity.as_of} · {statusLabels[identity.status]}
        </strong>
        <p>{identity.reason}</p>
        {identity.market && identity.code && (
          <Link
            to={`${instrumentPath({ market: identity.market, code: identity.code })}?${new URLSearchParams({ end_date: identity.as_of })}`}
          >
            {markets[identity.market]} {identity.code} · 開啟來源研究
          </Link>
        )}
      </div>
      <p className="source-note">{security.note}</p>
      <h3>市場與代碼時間軸</h3>
      <p className="source-note">
        期間包含起日、不包含終日；未列出的期間不推定身分。顯示名稱是登錄標籤，只有有日期證據的名稱別名能確認歷史名稱。
      </p>
      {security.listings.length ? (
        <ol className="security-timeline" aria-label="證券市場時間軸">
          {[...security.listings]
            .sort((a, b) => a.valid_from.localeCompare(b.valid_from))
            .map((listing) => (
              <li key={listing.id}>
                <p>
                  <strong>
                    {listing.valid_from} → {listing.valid_to ?? '未記錄終止日'}
                  </strong>
                </p>
                <p>
                  {markets[listing.market]} · {listing.code} · {listing.name}
                </p>
                <p>
                  <Evidence value={listing.start_evidence} />
                </p>
                {listing.end_evidence && (
                  <p>
                    <Evidence value={listing.end_evidence} />
                  </p>
                )}
              </li>
            ))}
        </ol>
      ) : (
        <p>尚無已確認的掛牌期間。</p>
      )}
      <h3>名稱與國際識別碼沿革</h3>
      {security.identifiers.length ? (
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="證券別名與識別碼，可橫向捲動"
        >
          <table className="source-table">
            <thead>
              <tr>
                <th>類型</th>
                <th>名稱／識別碼</th>
                <th>有效起日</th>
                <th>有效終日（不含）</th>
                <th>證據</th>
              </tr>
            </thead>
            <tbody>
              {security.identifiers.map((identifier) => (
                <tr key={identifier.id}>
                  <td>{identifier.kind === 'isin' ? 'ISIN' : '歷史名稱'}</td>
                  <th>{identifier.value}</th>
                  <td>{identifier.valid_from}</td>
                  <td>{identifier.valid_to ?? '未記錄終止日'}</td>
                  <td>
                    <Evidence value={identifier.evidence} />
                    {identifier.end_evidence && (
                      <p>
                        <Evidence value={identifier.end_evidence} />
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>尚無已查證的名稱或 ISIN 沿革，不以目前名稱回填歷史。</p>
      )}
    </section>
  )
}
export function SecurityIdentityPage() {
  const data = useLoaderData() as IdentityPageData
  const revalidator = useRevalidator()
  const asOf = data.query.as_of ?? taipeiDate()
  const page = (n: number) =>
    `?${new URLSearchParams({ ...data.query, page: String(n) })}`
  return (
    <>
      <ResearchHeading
        title="歷史證券身分與市場時間軸"
        description="透過永久識別碼查閱有來源證據的掛牌期間、轉板與名稱沿革，按日期確認當時市場與代碼。"
      />
      <p className="source-note">
        這裡只讀取已查證的證券身分資料，不儲存行情。資料仍可能有缺口；沒有資料不等於未上市，識別碼也不代表歷史已完整涵蓋。
      </p>
      <Form
        method="get"
        className="search-form"
        key={`${data.securityId}/${asOf}/${data.query.code ?? ''}`}
      >
        {!data.securityId && (
          <>
            <label>
              證券代碼
              <input
                name="code"
                aria-label="身分搜尋證券代碼"
                defaultValue={data.query.code ?? ''}
                pattern="[0-9A-Za-z]{4,6}"
                maxLength={6}
                required
              />
            </label>
            <label>
              市場
              <select
                name="market"
                aria-label="身分搜尋市場"
                defaultValue={data.query.market ?? ''}
              >
                <option value="">全部市場沿革</option>
                {(['TWSE', 'TPEX', 'EMERGING'] as const).map((m) => (
                  <option key={m} value={m}>
                    {markets[m]}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="include_inactive" value="false" />
            <label className="identity-include-history">
              <input
                type="checkbox"
                name="include_inactive"
                value="true"
                aria-label="包含查詢日未掛牌的歷史身分"
                defaultChecked={data.query.include_inactive !== 'false'}
              />
              包含查詢日未掛牌的歷史身分
            </label>
          </>
        )}
        <label>
          身分查詢日期
          <input
            type="date"
            name="as_of"
            aria-label="身分查詢日期"
            defaultValue={asOf}
            min="1900-01-01"
            max={taipeiDate()}
            required
          />
        </label>
        <button className="button" disabled={revalidator.state !== 'idle'}>
          查詢歷史身分
        </button>
        {data.securityId && (
          <Link to="/research/security-identity">返回身分搜尋</Link>
        )}
      </Form>
      {data.error && (
        <section className="error-state" role="alert">
          <h2>身分資料無法取得</h2>
          <p>{data.error}</p>
          <button
            className="text-button"
            disabled={revalidator.state !== 'idle'}
            onClick={() => revalidator.revalidate()}
          >
            重新查詢身分資料
          </button>
        </section>
      )}
      {!data.search && !data.detail && !data.error && (
        <p>
          輸入代碼與日期，查看已登錄的永久證券身分。歷史代碼重用時，可能有多個不同識別碼。
        </p>
      )}
      {data.search && (
        <section className="section">
          <h2>符合的永久證券身分</h2>
          {!data.search.data.length && (
            <p>
              此條件沒有已查證的身分資料；無法據此推定當日市場別或合併不同證券。
            </p>
          )}
          <ul className="security-results">
            {data.search.data.map((security) => (
              <li key={security.id}>
                <Link
                  to={`/research/security-identity/${security.id}?${new URLSearchParams({ as_of: asOf })}`}
                >
                  {security.name}
                </Link>
                <p className="security-id">{security.id}</p>
                <p>
                  {statusLabels[security.market_at_as_of.status]} ·{' '}
                  {security.market_at_as_of.reason}
                </p>
              </li>
            ))}
          </ul>
          <p>
            {data.search.pagination.total} 個身分 · 第{' '}
            {data.search.pagination.page} 頁
          </p>
          <nav className="research-nav" aria-label="證券身分搜尋分頁">
            {data.search.pagination.page > 1 && (
              <Link to={page(data.search.pagination.page - 1)}>上一頁</Link>
            )}
            {data.search.pagination.page * data.search.pagination.limit <
              data.search.pagination.total && (
              <Link to={page(data.search.pagination.page + 1)}>下一頁</Link>
            )}
          </nav>
        </section>
      )}
      {data.detail && <SecurityTimeline security={data.detail} />}
    </>
  )
}
