import { memo, useEffect, useState } from 'react'
import { newsCurrencies, newsTime, refreshPrompt, type NewsCurrency, type NewsItem, type NewsRow } from './news-model'
import { useCurrencyNews } from './useCurrencyNews'
import './currency-news.css'

const implicationLabels = { supportive: 'Supportive', negative: 'Negative', mixed: 'Mixed', no_clear_signal: 'No clear fresh signal' }
function CheckedTime({ at, hours }: { at: string; hours: number }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  return <span className="news-checked">Checked {newsTime(at)} · {hours}-hour window
    {now >= Date.parse(at) + hours * 3600000 && <strong className="news-aging"> · Aging — refresh on demand</strong>}</span>
}
function Sources({ items }: { items: NewsItem[] }) {
  const sources = [...new Map(items.flatMap(i => i.sources).map(s => [s.url, s])).values()]
  return <>{sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>)}</>
}
const CurrencyRow = memo(function CurrencyRow({ row }: { row: NewsRow }) {
  const s = row.snapshot
  return <tr data-news-currency={row.currency}>
    <th scope="row">{row.currency}</th>
    <td>{s ? <>
      {s.items.length ? s.items.map((item, i) => <p className="news-item" key={i}><strong>{newsTime(item.published_at!)}</strong> — {item.summary}</p>) : <p>{s.coverage === 'unavailable' ? 'News coverage unavailable.' : `No qualifying news verified in this ${s.window_hours}-hour window.`}</p>}
      <CheckedTime at={s.checked_at} hours={s.window_hours} />
      {s.coverage !== 'checked' && <p className="news-gap">{s.coverage === 'partial' ? 'Partial coverage' : 'Coverage unavailable'}: {s.coverage_note}</p>}
      {s.coverage === 'checked' && s.coverage_note && <p>{s.coverage_note}</p>}
      {!!s.background.length && <details className="news-background"><summary>Older background · {s.background.length}</summary>
        {s.background.map((item, i) => <p key={i}><strong>{item.published_at ? newsTime(item.published_at) : 'Publication time unknown'}</strong> — {item.summary}
          {item.timing_note && <span> {item.timing_note}</span>} <Sources items={[item]} /></p>)}
      </details>}
    </> : <p>Not refreshed yet.</p>}</td>
    <td>{s ? <><span className={`news-implication ${s.implication}`}><i aria-hidden="true" />{implicationLabels[s.implication]}</span><p>{s.reason}</p></> : '—'}</td>
    <td className="news-sources">{s?.items.length ? <Sources items={s.items} /> : '—'}</td>
  </tr>
})

function savedScope(): NewsCurrency | 'ALL' {
  try { const value = localStorage.getItem('fyodor.currency-news.scope.v1'); if (value === 'ALL' || newsCurrencies.includes(value as NewsCurrency)) return value as NewsCurrency | 'ALL' } catch { /* Session defaults. */ }
  return 'ALL'
}
export const CurrencyNewsDock = memo(function CurrencyNewsDock() {
  const [scope, setScope] = useState(savedScope)
  const [hours, setHours] = useState(3)
  const [copied, setCopied] = useState<{ context: string; message: string } | null>(null)
  const news = useCurrencyNews()
  const context = `${scope}:${hours}`
  async function copy() {
    try { await navigator.clipboard.writeText(refreshPrompt(scope, hours)); setCopied({ context, message: 'Refresh prompt copied. Run it in your agent chat.' }) }
    catch { setCopied({ context, message: 'Could not copy the prompt. Allow clipboard access and retry.' }) }
  }
  function select(value: NewsCurrency | 'ALL') {
    setScope(value)
    try { localStorage.setItem('fyodor.currency-news.scope.v1', value) } catch { /* Retain session choice. */ }
  }
  return <section className="currency-news-dock" aria-label="Currency News">
    <header className="currency-news-header">
      <h2>Currency News</h2>
      <div className="news-currencies" role="group" aria-label="News currency">
        {(['ALL', ...newsCurrencies] as const).map(c => <button key={c} type="button" aria-pressed={scope === c} onClick={() => select(c)}>{c === 'ALL' ? 'All' : c}</button>)}
      </div>
      <label>Look back <select aria-label="News lookback" value={hours} onChange={event => setHours(Number(event.target.value))}>
        {[1, 3, 6, 12, 24].map(h => <option value={h} key={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>)}
      </select></label>
      <button type="button" onClick={() => { void copy() }}>Copy refresh prompt</button>
      <button type="button" onClick={news.reload}>Reload saved news</button>
    </header>
    <p className="news-help">On-demand research · publication and check times in Jakarta, AM/PM. Changing the lookback applies to your next research request.</p>
    <p className="news-copy-status" role="status">{copied?.context === context ? copied.message : ''}</p>
    {news.error && <p className="news-error" role="alert">{news.error}{news.data ? ' Showing the last loaded news with its original check times.' : ''}</p>}
    {!news.data && !news.error && <p role="status">Loading saved news…</p>}
    <div className="news-scroll" tabIndex={0} aria-label="Currency news table">
      <table className="currency-news-table"><thead><tr><th>Currency</th><th>Latest verified information · Jakarta, AM/PM</th><th>Fundamental implication</th><th>Sources</th></tr></thead>
        <tbody>{newsCurrencies.filter(c => scope === 'ALL' || scope === c).map(c => <CurrencyRow key={c} row={news.data?.rows.find(r => r.currency === c) ?? { currency: c, snapshot: null }} />)}</tbody>
      </table>
    </div>
  </section>
})
