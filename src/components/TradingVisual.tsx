import { useState } from 'react'
import {
  chartNumber,
  fieldLabel,
  findColumn,
  nameColumn,
  numericColumns,
  sourceDateColumn,
  valueLabel,
} from '../features/market/fields'
import type { SourceRow, TradingDataset } from '../services/twse'

export function TradingVisual({
  dataset,
  columns,
  rows,
}: {
  dataset: TradingDataset
  columns: string[]
  rows: SourceRow[]
}) {
  const metrics = numericColumns(columns, rows)
  const [selected, setSelected] = useState('')
  const metric = metrics.includes(selected) ? selected : metrics[0]
  const timeField = sourceDateColumn(columns)
  const labelField = nameColumn(columns) ?? columns[0]
  if (!rows.length) return null
  if (dataset.view === 'events' || dataset.view === 'calendar') {
    const detailField = columns.find((column) =>
      /原因|內容|事由|說明|措施|Description/i.test(column),
    )
    return (
      <section className="section" aria-labelledby="events-heading">
        <div className="section-heading">
          <h2 id="events-heading">
            {dataset.view === 'calendar' ? '日期與事項' : '交易事項'}
          </h2>
          <span className="muted">篩選結果前 6 筆，完整內容見下方表格</span>
        </div>
        <div className="event-grid">
          {rows.slice(0, 6).map((row, index) => (
            <article className="event-card" key={index}>
              <span className="event-date">
                {timeField
                  ? `${fieldLabel(timeField)}：${valueLabel(row[timeField])}`
                  : `事項 ${index + 1}`}
              </span>
              <h3>{valueLabel(row[labelField])}</h3>
              {detailField && detailField !== labelField && (
                <p>{valueLabel(row[detailField])}</p>
              )}
            </article>
          ))}
        </div>
      </section>
    )
  }
  if (
    dataset.view === 'prices' ||
    dataset.view === 'balances' ||
    dataset.view === 'holdings'
  ) {
    const preferred =
      dataset.view === 'prices'
        ? [
            'ClosingPrice',
            '收盤價',
            'OpeningPrice',
            '開盤價',
            'TradeVolume',
            '成交股數',
            '成交量',
            '本益比',
            '殖利率(%)',
            '股價淨值比',
          ]
        : dataset.view === 'holdings'
          ? [
              '外資及陸資持股比率',
              '外資及陸資持股比率(%)',
              '外資及陸資持有股數',
              '發行股數',
            ]
          : [
              '融資今日餘額',
              '融券今日餘額',
              '融資餘額',
              '融券餘額',
              '可借券賣出股數',
            ]
    const highlights = [
      ...new Set([
        ...preferred
          .map((name) => findColumn(metrics, [name]))
          .filter((column): column is string => Boolean(column)),
        ...metrics,
      ]),
    ].slice(0, 3)
    if (!highlights.length) return null
    return (
      <section className="section" aria-labelledby="record-heading">
        <div className="section-heading">
          <h2 id="record-heading">
            {valueLabel(rows[0][labelField])} · 首筆資料
          </h2>
          <span className="muted">數值及單位沿用官方欄位</span>
        </div>
        <dl className="summary-grid">
          {highlights.map((column) => (
            <div className="summary-card" key={column}>
              <dt>{fieldLabel(column)}</dt>
              <dd className="source-value">{valueLabel(rows[0][column])}</dd>
            </div>
          ))}
        </dl>
      </section>
    )
  }
  if (!metric || !['series', 'ranking'].includes(dataset.view)) return null
  const points = rows
    .slice(0, dataset.view === 'series' ? 200 : 12)
    .flatMap((row, index) => {
      const value = chartNumber(row[metric])
      return value === null
        ? []
        : [
            {
              value,
              label: valueLabel(
                row[
                  timeField && dataset.view === 'series'
                    ? timeField
                    : labelField
                ],
              ),
              raw: row[metric],
              index,
            },
          ]
    })
  if (!points.length) return null
  const low = Math.min(...points.map((point) => point.value))
  const high = Math.max(...points.map((point) => point.value))
  const span = high - low || Math.max(Math.abs(high) * 0.02, 1)
  const maxAbs = Math.max(...points.map((point) => Math.abs(point.value)), 1)
  const coords = points.map(
    (point, i) =>
      `${40 + (i / Math.max(points.length - 1, 1)) * 800},${180 - ((point.value - low) / span) * 140}`,
  )
  return (
    <section className="section chart-card" aria-labelledby="visual-heading">
      <div className="section-heading">
        <div>
          <h2 id="visual-heading">
            {dataset.view === 'series' ? '資料序列' : '數值比較'}
          </h2>
          <p className="muted">
            沿用官方資料順序與單位，顯示篩選結果前{' '}
            {dataset.view === 'series' ? 200 : 12} 筆。
          </p>
        </div>
        <label>
          比較欄位{' '}
          <select
            value={metric}
            onChange={(event) => setSelected(event.target.value)}
          >
            {metrics.map((column) => (
              <option value={column} key={column}>
                {fieldLabel(column)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {dataset.view === 'series' ? (
        <>
          <svg
            className="series-chart"
            viewBox="0 0 880 230"
            role="img"
            aria-label={`${fieldLabel(metric)}資料序列，原始數值見下方資料表`}
          >
            <line x1="40" y1="185" x2="840" y2="185" stroke="#c7d4c7" />
            <polyline
              points={coords.join(' ')}
              fill="none"
              stroke="#176457"
              strokeWidth="3"
            />
            {points.map((point, i) => (
              <circle
                key={point.index}
                cx={coords[i].split(',')[0]}
                cy={coords[i].split(',')[1]}
                r="3"
                fill="#176457"
              >
                <title>
                  {point.label}：{point.raw}
                </title>
              </circle>
            ))}
            <text x="40" y="215">
              {points[0].label}
            </text>
            <text x="840" y="215" textAnchor="end">
              {points.at(-1)?.label}
            </text>
            <text x="40" y="20">
              {fieldLabel(metric)} · {points[0].raw} → {points.at(-1)?.raw}
            </text>
          </svg>
          <p className="muted chart-note">
            圖形以近似數值繪製；線段依來源順序連接。精確值與日期請查看資料表。
          </p>
        </>
      ) : (
        <ol className="bar-list">
          {points.map((point) => (
            <li key={point.index}>
              <span>{point.label}</span>
              <div className="bar-track">
                <span
                  style={{
                    width: `${(Math.abs(point.value) / maxAbs) * 100}%`,
                  }}
                />
              </div>
              <strong>{point.raw}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
