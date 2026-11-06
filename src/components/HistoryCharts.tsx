import type { HistoryPoint } from '../services/analysis'

const numeric = (value: string | null): number | null => {
  if (value === null || value.trim() === '') return null
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}
const label = (value: number) =>
  new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 2,
    notation: 'compact',
  }).format(value)

export function CandleChart({
  points,
  overlay = 'ma',
}: {
  points: HistoryPoint[]
  overlay?: 'ma' | 'bollinger'
}) {
  if (!points.length) return null
  const available = points.filter((p) => p.price_available)
  const series =
    overlay === 'ma'
      ? ([
          { field: 'ma20', label: 'MA20', color: '#a85b13' },
          { field: 'ma60', label: 'MA60', color: '#5c4ca0' },
        ] as const)
      : ([
          { field: 'bollinger_upper', label: '布林上軌', color: '#5c4ca0' },
          { field: 'bollinger_middle', label: '布林中軌', color: '#a85b13' },
          { field: 'bollinger_lower', label: '布林下軌', color: '#157347' },
        ] as const)
  const low = Math.min(
    ...(available.length
      ? available.flatMap((p) =>
          [Number(p.low), ...series.map((s) => numeric(p[s.field]))].filter(
            (n): n is number => n !== null,
          ),
        )
      : [0]),
  )
  const high = Math.max(
    ...(available.length
      ? available.flatMap((p) =>
          [Number(p.high), ...series.map((s) => numeric(p[s.field]))].filter(
            (n): n is number => n !== null,
          ),
        )
      : [1]),
  )
  if (![low, high].every(Number.isFinite))
    return <p>圖表資料無法辨識，請查看明細。</p>
  const span = high - low || Math.max(high * 0.02, 1)
  const y = (v: number) => 35 + ((high + span * 0.05 - v) / (span * 1.1)) * 240
  const x = (i: number) => 65 + ((i + 0.5) / points.length) * 810
  const width = Math.max(0.8, Math.min(12, (810 / points.length) * 0.65))
  const maxVolume = Math.max(1, ...points.map((p) => Number(p.volume)))
  const maPath = (field: (typeof series)[number]['field']) => {
    let connected = false
    return points
      .map((point, i) => {
        const value = point.price_available ? numeric(point[field]) : null
        if (value === null) {
          connected = false
          return ''
        }
        const command = connected ? 'L' : 'M'
        connected = true
        return `${command}${x(i)},${y(value)}`
      })
      .join(' ')
  }
  return (
    <figure className="chart-card history-chart" tabIndex={0}>
      <figcaption>歷史日 K 與成交量 · 原始股價（未還原）</figcaption>
      <p className="chart-legend">
        <span>紅：收盤高於開盤</span>
        <span>綠：收盤低於開盤</span>
        {series.map((s) => (
          <span key={s.field} style={{ color: s.color }}>
            {s.label}
          </span>
        ))}
      </p>
      <svg
        className="series-chart"
        viewBox="0 0 900 400"
        role="img"
        aria-label={`${points[0].date} 至 ${points.at(-1)?.date} 日 K、${overlay === 'ma' ? 'MA20、MA60' : '布林通道'} 與成交量圖`}
      >
        {(available.length ? [high, (high + low) / 2, low] : []).map((v, i) => (
          <g key={i}>
            <line x1="60" x2="880" y1={y(v)} y2={y(v)} stroke="#e0e6dd" />
            <text x="54" y={y(v) + 4} textAnchor="end">
              {label(v)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const open = Number(p.open),
            close = Number(p.close)
          const color =
            close === open ? '#617168' : close > open ? '#ba3438' : '#157347'
          const volumeHeight = (Number(p.volume) / maxVolume) * 65
          return (
            <g key={p.date}>
              <title>
                {p.price_available
                  ? `${p.date}｜開盤欄 ${p.open}｜高 ${p.high}｜低 ${p.low}｜收 ${p.close}｜成交 ${p.volume} 股`
                  : `${p.date}｜無公告成交價｜成交 ${p.volume} 股`}
              </title>
              {p.price_available && (
                <>
                  <line
                    x1={x(i)}
                    x2={x(i)}
                    y1={y(Number(p.high))}
                    y2={y(Number(p.low))}
                    stroke={color}
                  />
                  {p.opening_reference ? (
                    <line
                      x1={x(i) - width / 2}
                      x2={x(i) + width / 2}
                      y1={y(close)}
                      y2={y(close)}
                      stroke={color}
                    />
                  ) : (
                    <rect
                      x={x(i) - width / 2}
                      y={Math.min(y(open), y(close))}
                      width={width}
                      height={Math.max(1, Math.abs(y(close) - y(open)))}
                      fill={color}
                    />
                  )}
                </>
              )}
              <rect
                x={x(i) - width / 2}
                y={365 - volumeHeight}
                width={width}
                height={volumeHeight}
                fill={color}
                opacity="0.55"
              />
            </g>
          )
        })}
        {series.map((s) => (
          <path
            key={s.field}
            d={maPath(s.field)}
            fill="none"
            stroke={s.color}
            strokeWidth="1.8"
          />
        ))}
        {!available.length && (
          <text x="60" y="150">
            本期間無公告成交價，僅顯示成交量。
          </text>
        )}
        <text x="60" y="300">
          成交股數
        </text>
        <text x="60" y="390">
          {points[0].date}
        </text>
        <text x="880" y="390" textAnchor="end">
          {points.at(-1)?.date}
        </text>
      </svg>
      <p className="source-note">
        窄螢幕可左右滑動圖表。
        均線以來源已提供的日資料計算；筆數不足時留空。詳細數值請查看下方明細。
      </p>
      {points.some((p) => !p.price_available) && (
        <p className="source-note">
          無公告成交價的日期保留成交量，價格及指標留空，不以零元計算。
        </p>
      )}
      {points.some((p) => p.opening_reference) && (
        <p className="source-note">
          部分開盤欄超出高低區間，圖中只呈現高低與收盤；興櫃期間的開盤欄可能代表前日均價。
        </p>
      )}
    </figure>
  )
}

export function ResearchBars({
  title,
  points,
  unit,
}: {
  title: string
  points: { date: string; value: string | null }[]
  unit: string
}) {
  const rows = points.map((p) => ({ ...p, number: numeric(p.value) }))
  const numbers = rows
    .map((p) => p.number)
    .filter((n): n is number => n !== null)
  if (!numbers.length) return null
  const min = Math.min(0, ...numbers),
    max = Math.max(0, ...numbers)
  const y = (n: number) => 25 + ((max - n) / (max - min || 1)) * 170
  const zero = y(0),
    width = Math.max(1, Math.min(24, (810 / rows.length) * 0.7))
  return (
    <figure className="chart-card history-chart" tabIndex={0}>
      <figcaption>
        {title}（{unit}）
      </figcaption>
      <svg
        className="series-chart"
        viewBox="0 0 900 235"
        role="img"
        aria-label={title}
      >
        <line x1="60" x2="880" y1={zero} y2={zero} stroke="#9bab9f" />
        <text x="54" y={y(max) + 4} textAnchor="end">
          {label(max)}
        </text>
        {min < 0 && (
          <text x="54" y={y(min) + 4} textAnchor="end">
            {label(min)}
          </text>
        )}
        {rows.map((p, i) =>
          p.number === null ? null : (
            <rect
              key={p.date}
              x={65 + ((i + 0.5) / rows.length) * 810 - width / 2}
              y={Math.min(zero, y(p.number))}
              width={width}
              height={Math.abs(zero - y(p.number))}
              fill={p.number < 0 ? '#157347' : '#a85b13'}
            >
              <title>
                {p.date}：{p.value} {unit}
              </title>
            </rect>
          ),
        )}
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
