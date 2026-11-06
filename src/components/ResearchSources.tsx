import type { AnalysisMeta } from '../services/analysis'
import { safeSourceURL } from '../services/advancedLab'

const names: Record<string, string> = {
  TaiwanStockInfo: '證券參考名錄',
  TaiwanStockDelisting: '下市櫃參考名錄',
  TaiwanStockMonthRevenue: '月營收',
  TaiwanStockFinancialStatements: '綜合損益表',
  TaiwanStockBalanceSheet: '資產負債表',
  TaiwanStockPrice: '原始日線',
  TaiwanStockPriceAdj: '還原日線',
  TaiwanStockSplitPrice: '分割事件',
  TaiwanStockCapitalReductionReferencePrice: '減資事件',
  TaiwanStockParValueChange: '面額變更',
  TaiwanStockDividendResult: '除權息事件',
}
export function ResearchSources({ sources }: { sources: AnalysisMeta[] }) {
  if (!sources.length) return null
  return (
    <details className="source-records">
      <summary>本次來源與取得時間</summary>
      <ul>
        {sources.map((source, index) => {
          const href = safeSourceURL(source.source_url)
          return (
            <li key={index}>
              {href ? (
                <a href={href} target="_blank" rel="noreferrer">
                  FinMind · {names[source.dataset] ?? source.dataset}
                </a>
              ) : (
                (names[source.dataset] ?? source.dataset)
              )}{' '}
              · 取得時間{' '}
              {new Date(source.retrieved_at).toLocaleString('zh-TW', {
                timeZone: 'Asia/Taipei',
              })}
              （台北）
              {source.query_start &&
                ` · 來源查詢日期 ${source.query_start}${source.query_end && source.query_end !== source.query_start ? ` 至 ${source.query_end}` : ''}`}
            </li>
          )
        })}
      </ul>
    </details>
  )
}
