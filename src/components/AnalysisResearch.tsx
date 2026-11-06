import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { valueLabel } from '../features/market/fields'
import type { HistoryPoint, RevenuePoint } from '../services/analysis'
import { CandleChart, ResearchBars } from './HistoryCharts'

export function TechnicalResearch({ points }: { points: HistoryPoint[] }) {
  const [search] = useSearchParams()
  const [overlay, setOverlay] = useState<'ma' | 'bollinger'>(() =>
    search.get('overlay') === 'bollinger' ? 'bollinger' : 'ma',
  )
  const [indicator, setIndicator] = useState<'rsi' | 'macd'>(() =>
    search.get('indicator') === 'macd' ? 'macd' : 'rsi',
  )
  return (
    <>
      <div className="analysis-controls">
        <label>
          主圖指標
          <select
            aria-label="主圖指標"
            value={overlay}
            onChange={(e) => setOverlay(e.target.value as typeof overlay)}
          >
            <option value="ma">MA20／MA60</option>
            <option value="bollinger">布林通道（20，2）</option>
          </select>
        </label>
        <label>
          副圖指標
          <select
            aria-label="副圖指標"
            value={indicator}
            onChange={(e) => setIndicator(e.target.value as typeof indicator)}
          >
            <option value="rsi">RSI（14）</option>
            <option value="macd">MACD（12，26，9）</option>
          </select>
        </label>
      </div>
      <CandleChart points={points} overlay={overlay} />
      <IndicatorChart points={points} mode={indicator} />
      <p className="source-note">
        RSI 使用 Wilder 14 期平滑；MACD 使用 SMA 起始的 EMA12／26 與 EMA9
        訊號線，柱狀值為兩線之差，未乘二。 布林通道為 20
        期平均加減兩倍母體標準差。只計入有公告收盤價的資料；暖機不足時留空。
        使用未還原價格，除權息或分割會影響指標；數值是觀察工具，不代表買賣訊號。
      </p>
    </>
  )
}

function IndicatorChart({
  points,
  mode,
}: {
  points: HistoryPoint[]
  mode: 'rsi' | 'macd'
}) {
  const title = mode === 'rsi' ? 'RSI（14）' : 'MACD（12，26，9）'
  const series =
    mode === 'rsi'
      ? ([{ field: 'rsi14', label: 'RSI14', color: '#5c4ca0' }] as const)
      : ([
          { field: 'macd', label: 'MACD', color: '#a85b13' },
          { field: 'macd_signal', label: '訊號線', color: '#5c4ca0' },
        ] as const)
  const number = (value: string | null): number | null => {
    if (value === null || value.trim() === '') return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  const values = points.flatMap((p) =>
    p.price_available
      ? [
          ...series.map((s) => number(p[s.field])),
          ...(mode === 'macd' ? [number(p.macd_histogram)] : []),
        ].filter((n): n is number => n !== null)
      : [],
  )
  if (!values.length)
    return <p className="empty-state">{title} 尚無足夠有效收盤價可供計算。</p>
  const low = mode === 'rsi' ? 0 : Math.min(0, ...values)
  const high = mode === 'rsi' ? 100 : Math.max(0, ...values)
  const y = (v: number) =>
    high === low ? 110 : 25 + ((high - v) / (high - low)) * 170
  const x = (i: number) => 65 + ((i + 0.5) / points.length) * 810
  const ticks = mode === 'rsi' ? [0, 30, 70, 100] : [...new Set([low, 0, high])]
  return (
    <figure className="chart-card history-chart" tabIndex={0}>
      <figcaption>
        {title}
        {mode === 'macd' ? ' · 價差單位：元' : ''}
      </figcaption>
      <p className="chart-legend">
        {series.map((s) => (
          <span key={s.field} style={{ color: s.color }}>
            {s.label}
          </span>
        ))}
        {mode === 'macd' && <span>柱狀：MACD − 訊號線</span>}
      </p>
      <svg
        className="series-chart"
        viewBox="0 0 900 235"
        role="img"
        aria-label={title}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1="60" x2="880" y1={y(v)} y2={y(v)} stroke="#dfe6dd" />
            <text x="54" y={y(v) + 4} textAnchor="end">
              {new Intl.NumberFormat('zh-TW', {
                maximumFractionDigits: 2,
              }).format(v)}
            </text>
          </g>
        ))}
        {mode === 'macd' &&
          points.map((p, i) => {
            const v = p.price_available ? number(p.macd_histogram) : null
            const width = Math.max(
              0.8,
              Math.min(12, (810 / points.length) * 0.65),
            )
            return v === null ? null : (
              <rect
                key={p.date}
                x={x(i) - width / 2}
                y={Math.min(y(0), y(v))}
                width={width}
                height={Math.abs(y(v) - y(0))}
                fill={v < 0 ? '#157347' : '#ba3438'}
                opacity="0.5"
              >
                <title>
                  {p.date}：{p.macd_histogram}
                </title>
              </rect>
            )
          })}
        {series.map((s) => {
          let connected = false
          const d = points
            .map((p, i) => {
              const v = p.price_available ? number(p[s.field]) : null
              if (v === null) {
                connected = false
                return ''
              }
              const command = connected ? 'L' : 'M'
              connected = true
              return `${command}${x(i)},${y(v)}`
            })
            .join(' ')
          return (
            <path
              key={s.field}
              d={d}
              stroke={s.color}
              strokeWidth="1.8"
              fill="none"
            />
          )
        })}
        <text x="60" y="225">
          {points[0]?.date}
        </text>
        <text x="880" y="225" textAnchor="end">
          {points.at(-1)?.date}
        </text>
      </svg>
    </figure>
  )
}

export function RevenueResearch({ points }: { points: RevenuePoint[] }) {
  const [metric, setMetric] = useState<
    'revenue' | 'ytd_revenue' | 'trailing12_revenue'
  >('revenue')
  const titles = {
    revenue: '每月營收',
    ytd_revenue: '年初至當月累計營收',
    trailing12_revenue: '近 12 個月營收',
  }
  const latest = points.at(-1)
  return (
    <>
      {latest && (
        <div className="revenue-summary">
          <p className="source-note">
            最新營收月份：{latest.month}；累計比較均截至該月份。
          </p>
          <dl className="summary-grid">
            {[
              ['年初至當月累計營收（元）', latest.ytd_revenue],
              ['累計年增率（%）', latest.ytd_yoy],
              ['近 12 個月營收（元）', latest.trailing12_revenue],
              ['近 12 個月年增率（%）', latest.trailing12_yoy],
            ].map(([label, value]) => (
              <div className="summary-card" key={label}>
                <dt>{label}</dt>
                <dd>{valueLabel(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <label className="institution-select">
        營收圖表
        <select
          aria-label="營收圖表"
          value={metric}
          onChange={(e) => setMetric(e.target.value as typeof metric)}
        >
          {Object.entries(titles).map(([key, title]) => (
            <option key={key} value={key}>
              {title}
            </option>
          ))}
        </select>
      </label>
      {points.some((p) => p[metric] !== null) ? (
        <ResearchBars
          title={titles[metric]}
          unit="元"
          points={points.map((p) => ({ date: p.month, value: p[metric] }))}
        />
      ) : (
        <p className="empty-state">
          此營收指標所需月份尚不完整，暫無可繪製資料。
        </p>
      )}
      <p className="source-note">
        累計營收須當年 1 月至該月齊全，並與去年相同月份比較；近 12
        個月須連續月份齊全。 缺月不補零，去年比較基準不大於零時不顯示成長率。
      </p>
    </>
  )
}
