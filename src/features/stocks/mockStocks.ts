export interface Stock {
  instrumentId: string
  code: string
  name: string
  industry: string
  price: string
  changePercent: number
  volume: string
  pe: string
  yieldPercent: string
}

// Stable demo IDs are separate from the displayed stock codes. No API requests.
export const mockStocks: Stock[] = [
  {
    instrumentId: 'demo-tsmc',
    code: '2330',
    name: '台積電',
    industry: '半導體業',
    price: '1,050.00',
    changePercent: 1.45,
    volume: '28,640',
    pe: '24.8',
    yieldPercent: '1.52',
  },
  {
    instrumentId: 'demo-honhai',
    code: '2317',
    name: '鴻海',
    industry: '其他電子業',
    price: '198.50',
    changePercent: -0.75,
    volume: '42,180',
    pe: '15.6',
    yieldPercent: '2.72',
  },
  {
    instrumentId: 'demo-mediatek',
    code: '2454',
    name: '聯發科',
    industry: '半導體業',
    price: '1,320.00',
    changePercent: 0,
    volume: '8,920',
    pe: '21.3',
    yieldPercent: '3.64',
  },
]

export const demoTradeDate = '2026-10-16'

export function formatChange(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function changeClass(value: number) {
  return value > 0 ? 'rise' : value < 0 ? 'fall' : 'unchanged'
}
