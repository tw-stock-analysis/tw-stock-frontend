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
import { AdvancedResearchBlock } from '../src/components/AdvancedResearchBlock'
import type { ResearchBlock } from '../src/services/advanced'

afterEach(cleanup)
function block(
  id: string,
  columns: [string, string][],
  rows: Record<string, string | null>[],
): ResearchBlock {
  return {
    id,
    title: id,
    required_plan: 'Sponsor',
    columns: columns.map(([key, label]) => ({ key, label })),
    result: { status: 'ok', data: rows, meta: null, error: null },
  }
}

it('separates broker buy and sell rankings without changing the response', () => {
  render(
    <AdvancedResearchBlock
      block={block(
        'brokers',
        [
          ['date', '日期'],
          ['broker', '分點'],
          ['net', '買賣超股數'],
        ],
        [
          {
            date: '2026-07-31',
            broker: '甲分點',
            net: '25',
            buy: '30',
            sell: '5',
          },
          {
            date: '2026-07-31',
            broker: '乙分點',
            net: '-40',
            buy: '0',
            sell: '40',
          },
        ],
      )}
    />,
  )
  const table = screen.getByRole('table')
  expect(within(table).getAllByRole('row')[1]).toHaveTextContent('甲分點')
  fireEvent.change(screen.getByLabelText('分點排行'), {
    target: { value: 'sell' },
  })
  expect(within(table).getAllByRole('row')[1]).toHaveTextContent('乙分點')
  expect(within(table).getByText('-40')).toBeInTheDocument()
})

it('preserves exact ownership quantities and filters individual source grades', () => {
  render(
    <AdvancedResearchBlock
      block={block(
        'ownership',
        [
          ['date', '日期'],
          ['level', '級距'],
          ['shares', '股數'],
          ['percent', '比例'],
        ],
        [
          {
            date: '2026-07-31',
            level: '1-999',
            shares: '12345678901234567890',
            percent: '1.2',
          },
          {
            date: '2026-07-31',
            level: '1000001以上',
            shares: '999999',
            percent: '52.5',
          },
        ],
      )}
    />,
  )
  expect(screen.getByText('12345678901234567890')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('ownership資料分類'), {
    target: { value: '1000001以上' },
  })
  expect(screen.queryByText('12345678901234567890')).not.toBeInTheDocument()
  expect(
    within(screen.getByRole('table')).getByText('52.5'),
  ).toBeInTheDocument()
})

it('keeps ETF asset types in distinct series and does not fabricate undisclosed market value', () => {
  render(
    <AdvancedResearchBlock
      block={block(
        'holdings',
        [
          ['date', '日期'],
          ['name', '名稱'],
          ['asset_type', '資產'],
          ['shares', '數量'],
          ['weight', '權重'],
          ['market_value', '市值'],
        ],
        [
          {
            date: '2026-07-31',
            holding_key: 'cash||TWD',
            name: '現金',
            asset_type: 'cash',
            shares: '1000',
            weight: '2',
            market_value: null,
            currency: 'TWD',
          },
          {
            date: '2026-07-31',
            holding_key: 'futures|TX|TWD',
            name: '期貨',
            asset_type: 'futures',
            shares: '-3',
            weight: '-2',
            market_value: '-200',
            currency: 'TWD',
          },
        ],
      )}
    />,
  )
  expect(within(screen.getByRole('table')).getByText('—')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('holdings資料分類'), {
    target: { value: 'futures|TX|TWD' },
  })
  expect(screen.getByText('-3')).toBeInTheDocument()
  expect(screen.getByText('-200')).toBeInTheDocument()
  expect(
    screen.getByRole('option', { name: '期貨 · futures · TWD' }),
  ).toBeInTheDocument()
})
