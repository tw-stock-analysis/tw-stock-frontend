import { Link, useLoaderData, useRevalidator } from 'react-router-dom'
import {
  ResearchError,
  ResearchHeading,
  ResearchTable,
  ResearchToolbar,
} from '../components/ResearchTools'
import { StockSourceInfo } from '../components/StockSourceInfo'
import type { OverviewResponse, ResearchPageData } from '../services/research'

export function MarketOverviewPage() {
  const { response, error } =
    useLoaderData() as ResearchPageData<OverviewResponse>
  const loading = useRevalidator().state !== 'idle'
  return (
    <>
      <ResearchHeading
        title="市場總覽"
        description="從同一份日成交快照，查看最新交易日的漲跌分布及成交量排行。"
      />
      <ResearchToolbar />
      {loading ? (
        <p role="status">正在取得市場資料，原結果暫時隱藏。</p>
      ) : error ? (
        <ResearchError message={error} />
      ) : (
        response && (
          <>
            <section
              className="section summary-grid"
              aria-label="上市證券漲跌分布"
            >
              {(
                [
                  ['上漲', response.rising, 'rise'],
                  ['下跌', response.declining, 'fall'],
                  ['平盤', response.unchanged, 'unchanged'],
                ] as const
              ).map(([label, count, color]) => (
                <article className="summary-card" key={label}>
                  <h2>{label}</h2>
                  <strong className={color}>
                    {count.toLocaleString()} <small>檔</small>
                  </strong>
                </article>
              ))}
            </section>
            <p className="source-note">
              本次最新有效交易日共 {response.total.toLocaleString()}{' '}
              檔上市證券，含 ETF 等；無法分類{' '}
              {response.unclassified.toLocaleString()}{' '}
              檔。排除其他日期或日期不明的資料{' '}
              {response.excluded.toLocaleString()} 檔。
            </p>
            {!response.total && (
              <div className="empty-state">
                本次沒有可統計的有效交易日資料。
              </div>
            )}
            {(
              [
                ['漲幅前 10 名', response.gainers, 'change_percent', 'desc'],
                ['跌幅前 10 名', response.losers, 'change_percent', 'asc'],
                [
                  '成交量前 10 名',
                  response.volume_leaders,
                  'trade_volume',
                  'desc',
                ],
              ] as const
            ).map(([title, stocks, sort, order]) => (
              <section className="section" key={title} aria-label={title}>
                <div className="section-heading">
                  <h2>{title}</h2>
                  <Link to={`/research/screener?sort=${sort}&order=${order}`}>
                    前往篩選器 →
                  </Link>
                </div>
                {stocks.length ? (
                  <ResearchTable stocks={stocks} caption={title} />
                ) : (
                  <p className="empty-state">本次沒有符合此排行的證券。</p>
                )}
              </section>
            ))}
            <StockSourceInfo meta={response.meta} />
            <p className="source-note">
              <Link to="/market/market-indices">查看官方市場指數 →</Link>
            </p>
          </>
        )
      )}
    </>
  )
}
