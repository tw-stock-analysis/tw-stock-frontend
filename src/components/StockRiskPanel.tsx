import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStockRisks, type RiskResponse } from '../services/notices'
import { NoticeSources, PartialNoticeWarning, RiskCard } from './NoticeViews'

export function StockRiskPanel({ code }: { code: string }) {
  const [result, setResult] = useState<RiskResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const load = async () => {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const response = await getStockRisks(code, current.signal)
      current.signal.throwIfAborted()
      setResult(response)
    } catch (error) {
      if (!current.signal.aborted)
        setError(error instanceof Error ? error.message : '目前無法取得公告。')
    } finally {
      if (!current.signal.aborted) setLoading(false)
    }
  }
  return (
    <section className="section" aria-labelledby="stock-risk-heading">
      <div className="section-heading">
        <h2 id="stock-risk-heading">官方風險公告</h2>
        <button
          type="button"
          className="text-button"
          disabled={loading}
          onClick={load}
        >
          {loading
            ? '正在取得公告…'
            : result || error
              ? '重新取得風險公告'
              : '取得此股風險公告'}
        </button>
      </div>
      <p className="source-note">
        按下按鈕後，依序查詢注意、處置及暫停交易三份官方來源；不自行判斷目前生效狀態。
      </p>
      {loading && <p role="status">正在取得本次公告，原結果已清除。</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <>
          {!result.complete && <PartialNoticeWarning />}
          {result.data.length ? (
            <>
              <p>
                本次命中 {result.pagination.total} 筆公告，以下顯示前 3 筆。
              </p>
              <div className="notice-list">
                {result.data.slice(0, 3).map((notice) => (
                  <RiskCard notice={notice} key={notice.id} />
                ))}
              </div>
            </>
          ) : (
            <p className="empty-state">
              {result.complete
                ? '本次三份官方來源未列出此代碼。'
                : '目前成功取得的來源未列出此代碼，查詢尚不完整。'}
            </p>
          )}
          <p className="source-note">{result.note}</p>
          <NoticeSources sources={result.sources} />
        </>
      )}
      <p>
        <Link to={`/research/risks?${new URLSearchParams({ code })}`}>
          開啟此股完整公告頁 →
        </Link>
      </p>
    </section>
  )
}
