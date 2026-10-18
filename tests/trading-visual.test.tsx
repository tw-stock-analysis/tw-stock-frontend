// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { TradingVisual } from '../src/components/TradingVisual'
import { fieldLabel, numericColumns } from '../src/features/market/fields'
import type { SourceRow, TradingCatalog } from '../src/services/twse'
import catalogJSON from './fixtures/twse-catalog.json'

const catalog = catalogJSON as TradingCatalog
afterEach(cleanup)
function visual(id: string, rows: SourceRow[]) {
  const dataset = catalog.data.find((item) => item.id === id)!
  render(
    <TradingVisual
      dataset={dataset}
      columns={Object.keys(rows[0])}
      rows={rows}
    />,
  )
}

it('keeps rank, identifiers, dates and fiscal periods out of chart metrics while retaining monthly prices', () => {
  const row = {
    Rank: '1',
    No: '1',
    Number: '1',
    Code: '0050',
    STOCKsSecurityCode: '0050',
    Month: '11510',
    FiscalYearQuarter: '11503',
    LastTradingDay: '1151016',
    MonthlyAveragePrice: '100.5000',
    ETFsNumberofTradingAccounts: '1234',
  }
  expect(numericColumns(Object.keys(row), [row])).toEqual([
    'MonthlyAveragePrice',
    'ETFsNumberofTradingAccounts',
  ])
  expect(fieldLabel('TradeVolume', 'daily-prices')).toBe('成交股數')
  expect(fieldLabel('TradeVolume', 'after-hours')).toBe('成交數量')
  expect(fieldLabel('未知新欄位', 'daily-prices')).toBe('未知新欄位')
})

it('compares trading volume instead of rank', () => {
  visual('volume-top20', [
    {
      Date: '1151016',
      Rank: '1',
      Code: '0050',
      Name: '測試標的',
      TradeVolume: '123456',
    },
  ])
  const select = screen.getByRole('combobox', { name: '比較欄位' })
  expect(select).toHaveValue('TradeVolume')
  expect(
    within(select).queryByRole('option', { name: /排名/ }),
  ).not.toBeInTheDocument()
  expect(
    within(screen.getByRole('list')).getByText('測試標的'),
  ).toBeInTheDocument()
})

it('uses matching ETF or stock names when switching the paired ranking metric', () => {
  visual('etf-recurring-ranking', [
    {
      No: '1',
      STOCKsSecurityCode: '2330',
      STOCKsName: '測試股票',
      STOCKsNumberofTradingAccounts: '100',
      ETFsSecurityCode: '0050',
      ETFsName: '測試ETF',
      ETFsNumberofTradingAccounts: '200',
    },
  ])
  const select = screen.getByRole('combobox', { name: '比較欄位' })
  expect(select).toHaveValue('ETFsNumberofTradingAccounts')
  expect(
    within(screen.getByRole('list')).getByText('測試ETF'),
  ).toBeInTheDocument()
  fireEvent.change(select, {
    target: { value: 'STOCKsNumberofTradingAccounts' },
  })
  expect(
    within(screen.getByRole('list')).getByText('測試股票'),
  ).toBeInTheDocument()
  expect(
    within(screen.getByRole('list')).queryByText('測試ETF'),
  ).not.toBeInTheDocument()
})

it('recognizes the official English start date and reason in event cards', () => {
  visual('day-trading-suspensions', [
    {
      Code: '0050',
      Name: '測試標的',
      StartDate: '1151016',
      EndDate: '1151020',
      Reason: '測試原因',
    },
  ])
  expect(screen.getByText('停止先賣後買開始日：1151016')).toBeInTheDocument()
  expect(screen.getByText('測試原因')).toBeInTheDocument()
})

it('shows the published day trading suspension flag without inventing trade statistics', () => {
  visual('day-trading', [
    { Date: '1151016', Code: '0050', Name: '測試標的', Suspension: 'Y' },
  ])
  expect(screen.getByRole('heading', { name: '交易事項' })).toBeInTheDocument()
  expect(screen.getByText('Y')).toBeInTheDocument()
  expect(screen.queryByText('餘額與交易統計明細')).not.toBeInTheDocument()
})

it('highlights the actual foreign holdings percentage for the named industry', () => {
  visual('foreign-industries', [
    {
      IndustryCat: '測試產業',
      Numbers: '30',
      ShareNumber: '10000',
      ForeignMainlandAreaShare: '5000',
      Percentage: '50.0000',
    },
  ])
  expect(
    screen.getByRole('heading', { name: '測試產業 · 首筆資料' }),
  ).toBeInTheDocument()
  expect(screen.getByText('僑外資及陸資持股比率')).toBeInTheDocument()
  expect(screen.getByText('50.0000')).toBeInTheDocument()
  expect(screen.queryByText('家數')).not.toBeInTheDocument()
})

it('keeps block trade classes separate when drawing a dated series', () => {
  visual('block-daily', [
    { Date: '1151015', Class: '測試甲類', Type: '單筆', TradeVolume: '10' },
    { Date: '1151015', Class: '測試乙類', Type: '單筆', TradeVolume: '100' },
    { Date: '1151016', Class: '測試甲類', Type: '單筆', TradeVolume: '20' },
    { Date: '1151016', Class: '測試乙類', Type: '單筆', TradeVolume: '200' },
    { Date: '1151016', Class: '測試無數值', Type: '單筆', TradeVolume: '--' },
  ])
  const chart = screen.getByRole('img')
  expect(chart.querySelectorAll('circle')).toHaveLength(2)
  expect(within(chart).getByText('成交股數 · 10 → 20')).toBeInTheDocument()
  const group = screen.getByRole('combobox', { name: '資料分類' })
  fireEvent.change(group, {
    target: { value: JSON.stringify(['測試乙類', '單筆']) },
  })
  expect(chart.querySelectorAll('circle')).toHaveLength(2)
  expect(within(chart).getByText('成交股數 · 100 → 200')).toBeInTheDocument()
  fireEvent.change(group, {
    target: { value: JSON.stringify(['測試無數值', '單筆']) },
  })
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('沒有可繪圖數值')
  expect(group).toBeInTheDocument()
  fireEvent.change(group, {
    target: { value: JSON.stringify(['測試甲類', '單筆']) },
  })
  expect(screen.getByRole('img').querySelectorAll('circle')).toHaveLength(2)
})
