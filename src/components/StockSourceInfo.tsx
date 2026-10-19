import type { StockSource } from '../services/stocks'

export function StockSourceInfo({
  meta,
  perRecordDate = false,
}: {
  meta: StockSource
  perRecordDate?: boolean
}) {
  return (
    <div className="source-note">
      <p>
        資料日期：
        {meta.data_date ||
          (perRecordDate ? '請見各筆資料列' : '來源未提供資料日期')}
      </p>
      <p>
        取得時間（臺北）：
        {new Intl.DateTimeFormat('zh-TW', {
          timeZone: 'Asia/Taipei',
          dateStyle: 'short',
          timeStyle: 'medium',
        }).format(new Date(meta.retrieved_at))}
      </p>
      <p>
        {meta.note}{' '}
        <a href={meta.source_url} target="_blank" rel="noreferrer">
          TWSE 官方來源 ↗
        </a>
      </p>
    </div>
  )
}
