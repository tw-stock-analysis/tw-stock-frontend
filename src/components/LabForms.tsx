import type { FactorQuery, InstrumentRef, Market } from '../services/lab'
import { formatRefs, markets, parseRefs, rules, metrics } from '../services/lab'
import { taipeiDate } from '../services/analysis'

export function InstrumentFields({
  value,
  onChange,
}: {
  value: InstrumentRef
  onChange: (value: InstrumentRef) => void
}) {
  return (
    <>
      <label>
        市場
        <select
          aria-label="市場"
          value={value.market}
          onChange={(e) =>
            onChange({ ...value, market: e.target.value as Market })
          }
        >
          {Object.entries(markets).map(([v, n]) => (
            <option key={v} value={v}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        證券代碼
        <input
          value={value.code}
          pattern="[0-9A-Z]{4,6}"
          maxLength={6}
          required
          onChange={(e) =>
            onChange({ ...value, code: e.target.value.toUpperCase() })
          }
        />
      </label>
    </>
  )
}
export function FactorFields({
  value,
  onChange,
}: {
  value: FactorQuery
  onChange: (value: FactorQuery) => void
}) {
  return (
    <>
      <label>
        候選證券（1–10 檔，每行市場:代碼）
        <textarea
          name="candidates"
          aria-label="候選證券（1–10 檔，每行市場:代碼）"
          defaultValue={formatRefs(value.instruments)}
          key={formatRefs(value.instruments)}
          rows={4}
          required
          onBlur={(e) => {
            try {
              onChange({ ...value, instruments: parseRefs(e.target.value) })
              e.target.setCustomValidity('')
            } catch (error) {
              e.target.setCustomValidity(
                error instanceof Error ? error.message : '格式不正確',
              )
            }
          }}
          onChange={(e) => e.target.setCustomValidity('')}
        />
      </label>
      <label>
        資料期間截止
        <input
          type="date"
          value={value.as_of}
          min="2001-01-01"
          max={taipeiDate()}
          required
          onChange={(e) => onChange({ ...value, as_of: e.target.value })}
        />
      </label>
      {Object.entries(rules).map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            type="number"
            step={key.includes('streak') ? '1' : 'any'}
            min={key.includes('streak') ? '1' : undefined}
            max={key.includes('streak') ? '20' : undefined}
            value={value.rules[key as keyof typeof rules] ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                rules: { ...value.rules, [key]: e.target.value || undefined },
              })
            }
          />
        </label>
      ))}
      <label>
        排序
        <select
          aria-label="排序"
          value={value.sort}
          onChange={(e) =>
            onChange({ ...value, sort: e.target.value as FactorQuery['sort'] })
          }
        >
          <option value="code">市場與代碼</option>
          {Object.entries(metrics).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={value.descending}
          onChange={(e) => onChange({ ...value, descending: e.target.checked })}
        />
        由大到小
      </label>
    </>
  )
}
