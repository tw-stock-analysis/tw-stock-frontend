import type { SourceRow } from '../../services/twse'
import columnLabels from './column-labels.json'

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
// TWSE Swagger descriptions, verified 2026-10-18. These are documentation,
// not cached market data. A column can have different units in different APIs.
const datasetLabels: Record<string, Record<string, string>> = columnLabels
export const fieldLabel = (key: string, datasetId?: string) =>
  (datasetId ? datasetLabels[datasetId]?.[key] : undefined) ??
  labels[key] ??
  key
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

export function numericColumns(
  columns: string[],
  rows: SourceRow[],
  datasetId?: string,
) {
  return columns.filter(
    (column) =>
      !/日期|年月|年度|月份|時間|成交日|代號|代碼|序號|排名|排行|排序|編號|星期|^(date|time|code|year|month|rank|no|number)$|(Date|Time|Code|Year|YearQuarter|TradingDay)$/i.test(
        column,
      ) &&
      !/日期|年月|年度|月份|時間|成交日|代號|代碼|序號|排名|排行|排序|編號|星期/.test(
        fieldLabel(column, datasetId),
      ) &&
      rows.slice(0, 100).some((row) => chartNumber(row[column]) !== null),
  )
}
export function sourceDateColumn(columns: string[]) {
  return findColumn(columns, [
    '日期',
    'Date',
    '資料日期',
    '交易日期',
    'StartDate',
    '1stTradingDate',
    'TradingHaltDate',
    'LastTradingDay',
    '出表日期',
    '年月',
    'Month',
    '年度',
    'Year',
    '時間',
    'Time',
  ])
}
export function nameColumn(columns: string[], metric?: string) {
  if (metric?.startsWith('ETFs')) return findColumn(columns, ['ETFsName'])
  if (metric?.startsWith('STOCKs')) return findColumn(columns, ['STOCKsName'])
  return findColumn(columns, [
    '證券名稱',
    '股票名稱',
    '名稱',
    'SecurName',
    'Name',
    '權證名稱',
    '指數',
    '指數名稱',
    '產業別',
    'IndustryCat',
    '類型',
    'Class',
    'Type',
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
