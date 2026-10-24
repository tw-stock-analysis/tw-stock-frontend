import {
  Form,
  Link,
  NavLink,
  useLoaderData,
  useRevalidator,
} from 'react-router-dom'
import { AdvancedResearchBlock } from '../components/AdvancedResearchBlock'
import { researchTopics, type AdvancedPageData } from '../services/advanced'
import { taipeiDate } from '../services/analysis'

export function AdvancedResearchPage() {
  const { code, topic, start, end, response, error } =
    useLoaderData() as AdvancedPageData
  const revalidator = useRevalidator()
  const loading = revalidator.state !== 'idle'
  return (
    <>
      <header className="page-heading">
        <Link className="text-link" to={`/stocks/${code}`}>
          ← 返回個股摘要
        </Link>
        <p className="eyebrow">FINMIND · 進階研究</p>
        <h1>
          {response?.name ?? code} · {researchTopics[topic]}
        </h1>
        <p className="intro">選擇研究項目與日期，每次查詢重新取得來源。</p>
      </header>
      <nav className="research-nav" aria-label="個股研究項目">
        <Link to={`/stocks/${code}/history`}>技術與營收</Link>
        {Object.entries(researchTopics).map(([key, title]) => (
          <NavLink key={key} to={`/stocks/${code}/research/${key}`}>
            {title}
          </NavLink>
        ))}
      </nav>
      <Form
        method="get"
        className="search-form history-form"
        key={`${topic}/${start}/${end}`}
      >
        {topic !== 'brokers' && (
          <label>
            開始日期
            <input
              type="date"
              name="start_date"
              defaultValue={start}
              min="1994-10-01"
              max={taipeiDate()}
              required
            />
          </label>
        )}
        <label>
          {topic === 'brokers' ? '查詢日期' : '截止日期'}
          <input
            type="date"
            name="end_date"
            defaultValue={end}
            min="1994-10-01"
            max={taipeiDate()}
            required
          />
        </label>
        <button className="button" type="submit" disabled={loading}>
          查詢研究資料
        </button>
        <button
          className="text-button"
          type="button"
          disabled={loading}
          onClick={() => revalidator.revalidate()}
        >
          重新取得
        </button>
        <p className="source-note">
          {topic === 'brokers'
            ? '券商分點每次查詢單一日期。'
            : topic === 'etf'
              ? '主動式 ETF 持股每次最多 31 天。'
              : '每次最多查詢 1,830 天。'}{' '}
          付費資料須後端 Token 具相應權限；來源失敗不沿用舊資料。
        </p>
      </Form>
      {loading ? (
        <p role="status" className="source-status">
          正在依序取得本次研究資料，原結果暫時隱藏。
        </p>
      ) : error ? (
        <section role="alert" className="error-state">
          <h2>研究資料無法取得</h2>
          <p>{error}</p>
        </section>
      ) : (
        response && (
          <>
            <ul className="research-notes">
              {response.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            {!response.complete && (
              <p role="alert" className="form-error">
                本次資料尚不完整，僅呈現本次成功取得的區塊。
              </p>
            )}
            {response.blocks.map((block) => (
              <AdvancedResearchBlock
                key={`${topic}/${code}/${start}/${end}/${block.id}`}
                block={block}
              />
            ))}
          </>
        )
      )}
    </>
  )
}
