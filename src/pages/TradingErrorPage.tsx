import {
  isRouteErrorResponse,
  Link,
  useRevalidator,
  useRouteError,
} from 'react-router-dom'

export function TradingErrorPage() {
  const error = useRouteError()
  const revalidator = useRevalidator()
  const missing = isRouteErrorResponse(error) && error.status === 404
  return (
    <section className="page-heading">
      <p className="eyebrow">TWSE · MARKET DATA</p>
      <h1>{missing ? '找不到這個交易資料頁面' : '交易資料服務暫時無法使用'}</h1>
      <p className="intro">
        {missing
          ? '請從交易資料目錄選擇功能。'
          : '目前無法讀取後端資料目錄，請確認後端連線後再試。'}
      </p>
      <div className="actions">
        <Link className="text-link" to="/market">
          返回交易資料 →
        </Link>
        {!missing && (
          <button
            className="button"
            disabled={revalidator.state !== 'idle'}
            onClick={() => revalidator.revalidate()}
          >
            重新取得
          </button>
        )}
      </div>
    </section>
  )
}
