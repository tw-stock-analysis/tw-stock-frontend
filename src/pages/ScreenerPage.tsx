import { useEffect, useRef, useState } from 'react'
import { Form, Link, useLoaderData, useRevalidator } from 'react-router-dom'
import {
  ResearchError,
  ResearchHeading,
  ResearchTable,
  ResearchToolbar,
} from '../components/ResearchTools'
import { StockSourceInfo } from '../components/StockSourceInfo'
import {
  downloadBlob,
  exportScreener,
  type ResearchPageData,
  type ScreenerResponse,
} from '../services/research'

export function ScreenerPage() {
  const { response, error, query } =
    useLoaderData() as ResearchPageData<ScreenerResponse>
  const loading = useRevalidator().state !== 'idle'
  const params = new URLSearchParams(query)
  const [selected, setSelected] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const exportController = useRef<AbortController | null>(null)
  useEffect(() => {
    setSelected([])
    setExportError(null)
    setExporting(false)
    return () => exportController.current?.abort()
  }, [response])
  useEffect(() => {
    if (loading) exportController.current?.abort()
  }, [loading])
  const pageLink = (page: number) => {
    const next = new URLSearchParams(query)
    next.set('page', String(page))
    return `/research/screener?${next}`
  }
  const exportData = async () => {
    const controller = new AbortController()
    exportController.current?.abort()
    exportController.current = controller
    setExporting(true)
    setExportError(null)
    try {
      const blob = await exportScreener(query, controller.signal)
      controller.signal.throwIfAborted()
      downloadBlob(blob, 'twse-screener.csv')
    } catch (error) {
      if (!controller.signal.aborted)
        setExportError(error instanceof Error ? error.message : '匯出失敗。')
    } finally {
      if (!controller.signal.aborted) setExporting(false)
    }
  }
  const pages = response
    ? Math.max(
        1,
        Math.ceil(response.pagination.total / response.pagination.limit),
      )
    : 1
  return (
    <>
      <ResearchHeading
        title="選股篩選器"
        description="從本次官方日成交資料，依價格、漲跌幅與成交量找出研究標的。"
      />
      <Form
        method="get"
        className="search-form screener-form"
        key={query}
        aria-label="選股條件"
      >
        <label>
          代碼或名稱
          <input
            name="q"
            type="search"
            defaultValue={params.get('q') ?? ''}
            maxLength={100}
            placeholder="例如 0050、台積電"
          />
        </label>
        <label>
          最低股價（元）
          <input
            name="min_price"
            type="number"
            min="0"
            max="1000000000000"
            step="0.000001"
            defaultValue={params.get('min_price') ?? ''}
          />
        </label>
        <label>
          最高股價（元）
          <input
            name="max_price"
            type="number"
            min="0"
            max="1000000000000"
            step="0.000001"
            defaultValue={params.get('max_price') ?? ''}
          />
        </label>
        <label>
          最低漲跌幅（%）
          <input
            name="min_change"
            type="number"
            min="-1000000"
            max="1000000"
            step="0.000001"
            defaultValue={params.get('min_change') ?? ''}
          />
        </label>
        <label>
          最高漲跌幅（%）
          <input
            name="max_change"
            type="number"
            min="-1000000"
            max="1000000"
            step="0.000001"
            defaultValue={params.get('max_change') ?? ''}
          />
        </label>
        <label>
          最低成交量（股）
          <input
            name="min_volume"
            type="number"
            min="0"
            step="1"
            defaultValue={params.get('min_volume') ?? ''}
          />
        </label>
        <label>
          排序欄位
          <select name="sort" defaultValue={params.get('sort') ?? 'code'}>
            <option value="code">證券代碼</option>
            <option value="closing_price">收盤價</option>
            <option value="change_percent">漲跌幅</option>
            <option value="trade_volume">成交股數</option>
            <option value="trade_value">成交金額</option>
          </select>
        </label>
        <label>
          排序方向
          <select name="order" defaultValue={params.get('order') ?? 'asc'}>
            <option value="asc">由小到大</option>
            <option value="desc">由大到小</option>
          </select>
        </label>
        <label>
          每頁筆數
          <select name="limit" defaultValue={params.get('limit') ?? '20'}>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
        <div className="screener-actions">
          <button className="button" type="submit" disabled={loading}>
            套用篩選
          </button>
          <Link to="/research/screener">清除條件</Link>
        </div>
      </Form>
      <ResearchToolbar />
      {loading ? (
        <p role="status">正在取得本次資料，原結果暫時隱藏。</p>
      ) : error ? (
        <ResearchError message={error} />
      ) : (
        response && (
          <>
            <section className="section" aria-labelledby="screener-results">
              <div className="section-heading">
                <h2 id="screener-results">
                  篩選結果
                  <span className="count">
                    {response.pagination.total.toLocaleString()} 檔
                  </span>
                </h2>
                <button
                  className="text-button"
                  disabled={exporting || !response.pagination.total}
                  onClick={exportData}
                >
                  {exporting ? '正在匯出…' : '匯出全部結果 CSV'}
                </button>
              </div>
              <p className="source-note">
                CSV
                會重新取得完整篩選結果，可能與目前畫面不同；代碼加上單引號以保留前導零。
              </p>
              {exportError && (
                <p role="alert" className="form-error">
                  {exportError}
                </p>
              )}
              <div className="comparison-selection">
                <span>已選 {selected.length} / 4 檔（可選 2～4 檔比較）</span>
                {selected.length >= 2 && (
                  <Link
                    className="button"
                    to={`/research/compare?${new URLSearchParams({ codes: selected.join(',') })}`}
                  >
                    比較所選證券
                  </Link>
                )}
              </div>
              {response.data.length ? (
                <ResearchTable
                  stocks={response.data}
                  caption="選股結果"
                  selected={selected}
                  onSelect={(code) =>
                    setSelected((current) =>
                      current.includes(code)
                        ? current.filter((item) => item !== code)
                        : [...current, code].slice(0, 4),
                    )
                  }
                />
              ) : (
                <div className="empty-state">
                  本頁沒有符合條件的資料，請調整條件或返回第一頁。
                  {response.pagination.page > 1 && (
                    <p>
                      <Link to={pageLink(1)}>返回第一頁</Link>
                    </p>
                  )}
                </div>
              )}
              {response.pagination.total > 0 && (
                <nav className="pagination" aria-label="篩選結果分頁">
                  {response.pagination.page > 1 ? (
                    <Link to={pageLink(response.pagination.page - 1)}>
                      上一頁
                    </Link>
                  ) : (
                    <span aria-disabled="true">上一頁</span>
                  )}
                  <span>
                    第 {response.pagination.page} / {pages} 頁
                  </span>
                  {response.pagination.page < pages ? (
                    <Link to={pageLink(response.pagination.page + 1)}>
                      下一頁
                    </Link>
                  ) : (
                    <span aria-disabled="true">下一頁</span>
                  )}
                </nav>
              )}
            </section>
            <p className="source-note">
              {response.calculation} 無法計算的資料顯示
              —；設定數值條件時排除該欄缺值。
            </p>
            <StockSourceInfo meta={response.meta} perRecordDate />
          </>
        )
      )}
    </>
  )
}
