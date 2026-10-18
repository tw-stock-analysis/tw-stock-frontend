import type { SourceRow } from '../../services/twse'

// Labels only; source strings and units are never converted.
const labels: Record<string, string> = {
  Date: '日期',
  Code: '證券代號',
  Name: '證券名稱',
  TradeVolume: '成交股數',
  TradeValue: '成交金額',
  OpeningPrice: '開盤價',
  HighestPrice: '最高價',
  LowestPrice: '最低價',
  ClosingPrice: '收盤價',
  Change: '漲跌價差',
  Transaction: '成交筆數',
}
export const fieldLabel = (key: string) => labels[key] ?? key
export const valueLabel = (value: string | null | undefined) =>
  value === '' || value == null ? '—' : value

export function findColumn(columns: string[], names: string[]) {
  return names
    .map((name) =>
      columns.find((column) => column.toLowerCase() === name.toLowerCase()),
    )
    .find((column): column is string => Boolean(column))
}

// Approximate numbers are used only in charts. Tables keep exact strings.
export function chartNumber(value: string | null | undefined): number | null {
  if (
    !value ||
    !/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?$/.test(value.trim())
  )
    return null
  const number = Number(value.replaceAll(',', '').replace('%', '').trim())
  return Number.isFinite(number) ? number : null
}

export function numericColumns(columns: string[], rows: SourceRow[]) {
  return columns.filter(
    (column) =>
      !/日期|年月|年度|時間|代號|代碼|序號|date|time|code|year|month/i.test(
        column,
      ) && rows.slice(0, 100).some((row) => chartNumber(row[column]) !== null),
  )
}
export function sourceDateColumn(columns: string[]) {
  return findColumn(columns, [
    '日期',
    'Date',
    '資料日期',
    '交易日期',
    '出表日期',
    '年月',
    '年度',
    '時間',
    'Time',
  ])
}
export function nameColumn(columns: string[]) {
  return findColumn(columns, [
    '證券名稱',
    '股票名稱',
    '名稱',
    'Name',
    '指數',
    '指數名稱',
    '產業別',
    '項目',
  ])
}
export function filterRows(
  rows: SourceRow[],
  query: string,
  field: string,
  value: string,
) {
  const search = query.trim().toLocaleLowerCase()
  return rows.filter(
    (row) =>
      (!search ||
        Object.values(row).some((cell) =>
          cell?.toLocaleLowerCase().includes(search),
        )) &&
      (!field || !value || (row[field] ?? '').includes(value)),
  )
}
