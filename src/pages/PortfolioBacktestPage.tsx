import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ResearchHeading } from '../components/ResearchTools'
import { ResearchBars } from '../components/HistoryCharts'
import { ResearchSources } from '../components/ResearchSources'
import { useResearchRequest } from '../components/useResearchRequest'
import { taipeiDate } from '../services/analysis'
import {
  defaultPortfolioQuery,
  portfolioPayload,
  type PortfolioBacktestQuery,
  type PortfolioBacktestResult,
  type PortfolioStrategy,
} from '../services/advancedLab'
import { labRequest, markets, type Market } from '../services/lab'

export function PortfolioBacktestPage() {
  const [draft, setDraft] = useState<PortfolioBacktestQuery>(
    defaultPortfolioQuery,
  )
  const request = useResearchRequest<PortfolioBacktestResult>()
  const fixed = draft.strategy === 'fixed_weights'
  function updateAsset(
    index: number,
    change: Partial<PortfolioBacktestQuery['assets'][number]>,
  ) {
    setDraft({
      ...draft,
      assets: draft.assets.map((asset, i) =>
        i === index ? { ...asset, ...change } : asset,
      ),
    })
  }
  function setStrategy(strategy: PortfolioStrategy) {
    setDraft({ ...draft, strategy })
  }
  function run() {
    void request.run((signal) =>
      labRequest<PortfolioBacktestResult>(
        '/research/portfolio-backtest',
        signal,
        'POST',
        portfolioPayload(draft),
      ),
    )
  }
  return (
    <>
      <ResearchHeading
        title="跨股因子與再平衡回測"
        description="指定研究組合，依月或季調整固定權重，或以動能／低波動因子選股；使用前一日資料、次一共同交易日開盤模擬成交。"
      />
      <form
        className="search-form lab-form"
        onSubmit={(e) => {
          e.preventDefault()
          run()
        }}
      >
        <fieldset disabled={request.busy}>
          <label>
            回測方式
            <select
              aria-label="回測方式"
              value={draft.strategy}
              onChange={(e) => setStrategy(e.target.value as PortfolioStrategy)}
            >
              <option value="fixed_weights">固定權重再平衡</option>
              <option value="momentum">跨股動能因子</option>
              <option value="low_volatility">跨股低波動因子</option>
            </select>
          </label>
          <label>
            再平衡頻率
            <select
              aria-label="再平衡頻率"
              value={draft.rebalance}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  rebalance: e.target.value as 'monthly' | 'quarterly',
                })
              }
            >
              <option value="monthly">每月第一個共同交易日</option>
              <option value="quarterly">每季第一個共同交易日</option>
            </select>
          </label>
          <label>
            開始日期
            <input
              aria-label="組合開始日期"
              type="date"
              value={draft.start_date}
              min="1994-10-01"
              max={taipeiDate()}
              required
              onChange={(e) =>
                setDraft({ ...draft, start_date: e.target.value })
              }
            />
          </label>
          <label>
            截止日期
            <input
              aria-label="組合截止日期"
              type="date"
              value={draft.end_date}
              min="1994-10-01"
              max={taipeiDate()}
              required
              onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
            />
          </label>
          <label>
            價格基礎
            <select
              aria-label="組合價格基礎"
              value={draft.basis}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  basis: e.target.value as PortfolioBacktestQuery['basis'],
                })
              }
            >
              <option value="unadjusted">原始股價（不含股利）</option>
              <option value="source_adjusted">
                來源還原價格（須相應權限）
              </option>
            </select>
          </label>
          {!fixed && (
            <>
              <label>
                因子觀察期（交易筆數）
                <input
                  aria-label="因子觀察期"
                  type="number"
                  min="20"
                  max="252"
                  step="1"
                  value={draft.lookback}
                  required
                  onChange={(e) =>
                    setDraft({ ...draft, lookback: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                每次選入檔數
                <input
                  aria-label="每次選入檔數"
                  type="number"
                  min="1"
                  max={draft.assets.length}
                  step="1"
                  value={draft.top_n}
                  required
                  onChange={(e) =>
                    setDraft({ ...draft, top_n: Number(e.target.value) })
                  }
                />
              </label>
            </>
          )}
          <h3>{fixed ? '配置權重（2–20 檔）' : '因子候選組合（2–20 檔）'}</h3>
          <p className="source-note">
            {fixed
              ? '權重使用 0–1 小數，總和不超過 1；剩餘部分保留現金。'
              : '因子只在指定候選間排序，選入證券等權配置；不是全市場歷史時點選股。'}
            同一代碼不能以不同市場重複配置。開始與截止日均需有所有證券的共同交易資料，不會默默縮短期間。
          </p>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="回測證券設定，可橫向捲動"
          >
            <table className="source-table asset-editor">
              <thead>
                <tr>
                  <th>市場</th>
                  <th>證券代碼</th>
                  {fixed && <th>目標權重（小數）</th>}
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {draft.assets.map((asset, index) => (
                  <tr key={index}>
                    <td>
                      <select
                        aria-label={`第 ${index + 1} 檔市場`}
                        value={asset.market}
                        onChange={(e) =>
                          updateAsset(index, {
                            market: e.target.value as Market,
                          })
                        }
                      >
                        {(['TWSE', 'TPEX', 'DELISTED'] as Market[]).map((m) => (
                          <option key={m} value={m}>
                            {markets[m]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label={`第 ${index + 1} 檔證券代碼`}
                        value={asset.code}
                        pattern="[0-9A-Z]{4,6}"
                        maxLength={6}
                        required
                        onChange={(e) =>
                          updateAsset(index, {
                            code: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </td>
                    {fixed && (
                      <td>
                        <input
                          aria-label={`第 ${index + 1} 檔目標權重`}
                          type="number"
                          min="0"
                          max="1"
                          step="0.00000001"
                          value={asset.weight ?? ''}
                          required
                          onChange={(e) =>
                            updateAsset(index, { weight: e.target.value })
                          }
                        />
                      </td>
                    )}
                    <td>
                      <button
                        className="text-button"
                        type="button"
                        disabled={draft.assets.length <= 2}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            assets: draft.assets.filter((_, i) => i !== index),
                            top_n: Math.min(
                              draft.top_n,
                              draft.assets.length - 1,
                            ),
                          })
                        }
                      >
                        移除第 {index + 1} 檔
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="text-button"
            type="button"
            disabled={draft.assets.length >= 20}
            onClick={() =>
              setDraft({
                ...draft,
                assets: [
                  ...draft.assets,
                  { market: 'TWSE', code: '', weight: '0' },
                ],
              })
            }
          >
            加入證券
          </button>
          {[
            ['initial_cash', '初始資金（元）', '1', '1000000000000', '0.01'],
            ['commission_rate', '手續費率（小數）', '0', '1', '0.00000001'],
            ['sell_tax_rate', '賣出稅率（小數）', '0', '1', '0.00000001'],
            ['slippage_rate', '滑價率（小數）', '0', '0.99', '0.00000001'],
            ['minimum_fee', '最低手續費（元）', '0', '10000', '0.01'],
          ].map(([key, label, min, max, step]) => (
            <label key={key}>
              {label}
              <input
                aria-label={label}
                type="number"
                min={min}
                max={max}
                step={step}
                value={draft[key as 'initial_cash']}
                required
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </label>
          ))}
          <label>
            交易單位
            <select
              aria-label="組合交易單位"
              value={draft.lot_size}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  lot_size: Number(e.target.value) as 1 | 1000,
                })
              }
            >
              <option value="1">零股（1 股）</option>
              <option value="1000">整張（1,000 股）</option>
            </select>
          </label>
          <label className="inline-check full-span">
            <input
              aria-label="允許身分未完整驗證的研究模式"
              type="checkbox"
              checked={draft.allow_unverified_identity}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  allow_unverified_identity: e.target.checked,
                })
              }
            />
            允許身分未完整驗證的研究模式；結果可能受轉板、代碼沿用或存活者偏誤影響。
          </label>
          <p className="source-note">
            預設要求回測期間的證券身分已驗證。
            <Link to="/research/security-identity">
              查看永久識別碼與市場時間軸
            </Link>
            。原始價格遇分割、減資等調整事件會停止；還原價格需要來源權限。模擬不含流動性、漲跌停排隊與成交失敗。
          </p>
          <button className="button">執行組合回測</button>
        </fieldset>
      </form>
      {request.busy && (
        <div className="source-toolbar">
          <p role="status">
            正在依序確認身分、企業行動與歷史價格，原結果暫時隱藏…
          </p>
          <button className="text-button" onClick={request.cancel}>
            取消本次回測
          </button>
        </div>
      )}
      {request.cancelled && <p role="status">已取消本次回測。</p>}
      {request.error && (
        <p role="alert" className="form-error">
          {request.error}
        </p>
      )}
      {request.result && !request.busy && (
        <section className="section">
          <h2>本次組合回測結果</h2>
          <p>
            {
              {
                fixed_weights: '固定權重再平衡',
                momentum: '跨股動能因子',
                low_volatility: '跨股低波動因子',
              }[request.result.parameters.strategy]
            }{' '}
            · {request.result.parameters.start_date} 至{' '}
            {request.result.parameters.end_date} ·{' '}
            {request.result.parameters.rebalance === 'monthly'
              ? '每月'
              : '每季'}
            再平衡
          </p>
          {request.result.parameters.allow_unverified_identity && (
            <p role="alert" className="source-note">
              本次允許身分未完整驗證的研究模式，結果可能受轉板、代碼沿用或存活者偏誤影響。
            </p>
          )}
          <ResearchSources sources={request.result.sources} />
          <dl className="lab-summary">
            {[
              ['期末資產（元）', request.result.summary.final_equity],
              ['區間報酬（%）', request.result.summary.return_percent],
              ['最大回撤（%）', request.result.summary.max_drawdown_percent],
              ['手續費與稅（元）', request.result.summary.fees_and_taxes],
              ['總成交額／初始資金（倍）', request.result.summary.turnover],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <ResearchBars
            title="組合資產曲線"
            unit="元"
            points={request.result.equity.map((point) => ({
              date: point.date,
              value: point.equity,
            }))}
          />
          <ul>
            {request.result.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
          <details>
            <summary>
              再平衡訊號與配置（{request.result.rebalances.length} 次）
            </summary>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="再平衡明細，可橫向捲動"
            >
              <table className="source-table">
                <thead>
                  <tr>
                    <th>訊號資料截止</th>
                    <th>模擬成交日期</th>
                    <th>目標配置</th>
                    <th>因子分數</th>
                  </tr>
                </thead>
                <tbody>
                  {request.result.rebalances.map((row, i) => (
                    <tr key={i}>
                      <td>{row.signal_date}</td>
                      <td>{row.execution_date}</td>
                      <td>
                        {Object.entries(row.weights).map(([key, value]) => (
                          <div key={key}>
                            {key}：{value}
                          </div>
                        ))}
                      </td>
                      <td>
                        {Object.entries(row.scores).length
                          ? Object.entries(row.scores).map(([key, value]) => (
                              <div key={key}>
                                {key}：{value ?? '—'}
                              </div>
                            ))
                          : '固定權重'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details>
            <summary>模擬成交紀錄（{request.result.orders.length} 筆）</summary>
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="組合成交明細，可橫向捲動"
            >
              <table className="source-table">
                <thead>
                  <tr>
                    {[
                      '日期',
                      '證券',
                      '方向',
                      '股數',
                      '模擬成交價',
                      '手續費',
                      '交易稅',
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {request.result.orders.map((row, i) => (
                    <tr key={i}>
                      <td>{row.date}</td>
                      <th>
                        {row.market}:{row.code}
                      </th>
                      <td>{row.side === 'buy' ? '買進' : '賣出'}</td>
                      <td>{row.quantity}</td>
                      <td>{row.price}</td>
                      <td>{row.fee}</td>
                      <td>{row.tax}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          {!request.result.orders.length && (
            <p>本次沒有可成交委託，資金保持現金。</p>
          )}
        </section>
      )}
    </>
  )
}
