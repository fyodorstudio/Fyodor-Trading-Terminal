import { memo, useCallback, useEffect, useState } from 'react'
import { newsCurrencies, newsTime, refreshPrompt, type NewsCurrency, type NewsDayRow, type NewsItem } from './news-model'
import { useNewsDay } from './useNewsDay'
import { downloadNews } from './news-export'
import { AlertDateSelector } from '../alert/dock/AlertDateSelector'
import { jakartaDate } from '../alert/model/alert-day-model'
import './currency-news.css'

const implicationLabels = { supportive: 'Supportive', negative: 'Negative', mixed: 'Mixed', no_clear_signal: 'No clear fresh signal' }
const emptyRows: NewsDayRow[] = newsCurrencies.map(currency => ({ currency, snapshot: null, refreshes: [] }))
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
type RowProps = { row: NewsDayRow; today: boolean; status?: 'loading' | 'unavailable'; select: (currency: NewsCurrency, id: string) => void }
const CurrencyRow = memo(function CurrencyRow({ row, today, status, select }: RowProps) {
  const s = row.snapshot
  const historical = !today || s?.run_id !== row.refreshes[0]?.run_id
  return <tr data-news-currency={row.currency}>
    <th scope="row">{row.currency}</th>
    <td>{row.refreshes.length > 1 && <select className="news-row-refresh" aria-label={`${row.currency} saved refresh`} value={s?.run_id ?? ''} onChange={event => select(row.currency, event.target.value === row.refreshes[0]?.run_id ? '' : event.target.value)}>
        {row.pending && <option value="">Loading…</option>}
        {row.refreshes.map((r, i) => <option key={r.run_id} value={r.run_id}>{i === 0 ? 'Latest · ' : ''}{newsTime(r.saved_at)} · #{i + 1}</option>)}
      </select>}{s ? <>
      {s.items.length ? s.items.map((item, i) => <p className="news-item" key={i}><strong>{newsTime(item.published_at!)}</strong> — {item.summary}</p>) : <p>{s.coverage === 'unavailable' ? 'News coverage unavailable.' : `No qualifying news verified in this ${s.window_hours}-hour window.`}</p>}
      <span className="news-checked">Saved {newsTime(s.saved_at)}{s.run_id !== row.refreshes[0]?.run_id ? ' · Earlier refresh selected' : ''}</span>
      {historical ? <span className="news-checked">Checked {newsTime(s.checked_at)} · {s.window_hours}-hour window · Saved snapshot</span> : <CheckedTime at={s.checked_at} hours={s.window_hours} />}
      {s.coverage !== 'checked' && <p className="news-gap">{s.coverage === 'partial' ? 'Partial coverage' : 'Coverage unavailable'}: {s.coverage_note}</p>}
      {s.coverage === 'checked' && s.coverage_note && <p>{s.coverage_note}</p>}
      {!!s.background.length && <details className="news-background"><summary>Older background · {s.background.length}</summary>
        {s.background.map((item, i) => <p key={i}><strong>{item.published_at ? newsTime(item.published_at) : 'Publication time unknown'}</strong> — {item.summary}
          {item.timing_note && <span> {item.timing_note}</span>} <Sources items={[item]} /></p>)}
      </details>}
    </> : <p>{row.pending || status === 'loading' ? 'Loading saved news…' : status === 'unavailable' ? 'Saved research unavailable.' : 'No research saved for this date.'}</p>}</td>
    <td>{s ? <><span className={`news-implication ${s.implication}`}><i aria-hidden="true" />{implicationLabels[s.implication]}</span><p>{s.reason}</p></> : '—'}</td>
    <td className="news-sources">{s?.items.length ? <Sources items={s.items} /> : '—'}</td>
  </tr>
}, (a, b) => a.today === b.today && a.status === b.status && a.select === b.select && a.row.currency === b.row.currency
  && a.row.snapshot === b.row.snapshot && a.row.refreshes === b.row.refreshes && a.row.pending === b.row.pending)

function savedScope(): NewsCurrency | 'ALL' {
  try { const value = localStorage.getItem('fyodor.currency-news.scope.v1'); if (value === 'ALL' || newsCurrencies.includes(value as NewsCurrency)) return value as NewsCurrency | 'ALL' } catch { /* Session defaults. */ }
  return 'ALL'
}
export const CurrencyNewsDock = memo(function CurrencyNewsDock() {
  const [scope, setScope] = useState(savedScope)
  const [hours, setHours] = useState(3)
  const [copied, setCopied] = useState<{ context: string; message: string } | null>(null)
  const [calendar, setCalendar] = useState(() => { const today = jakartaDate(Date.now()); return { today, date: today } })
  useEffect(() => {
    function updateCalendar() {
      const today = jakartaDate(Date.now())
      setCalendar(old => old.today === today ? old : { today, date: old.date === old.today ? today : old.date })
    }
    const timer = window.setInterval(updateCalendar, 60000)
    return () => window.clearInterval(timer)
  }, [])
  const { date } = calendar, today = date === calendar.today
  const news = useNewsDay(date, today)
  const rows = news.data ? news.rows : emptyRows
  const context = `${date}:${scope}:${hours}`
  const changeDate = useCallback((value: string) => setCalendar(old => ({ ...old, date: value })), [])
  async function copy() {
    if (date !== jakartaDate(Date.now())) return
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
      <AlertDateSelector date={date} onChange={changeDate} label="Currency News" />
      <div className="news-currencies" role="group" aria-label="News currency">
        {(['ALL', ...newsCurrencies] as const).map(c => <button key={c} type="button" aria-pressed={scope === c} onClick={() => select(c)}>{c === 'ALL' ? 'All' : c}</button>)}
      </div>
      {today && <><label>Look back <select aria-label="News lookback" value={hours} onChange={event => setHours(Number(event.target.value))}>
        {[1, 3, 6, 12, 24].map(h => <option value={h} key={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>)}
      </select></label>
      <button type="button" onClick={() => { void copy() }}>Copy refresh prompt</button>
      </>}
      <button type="button" onClick={news.reload}>Reload saved news</button>
      <button type="button" disabled={!news.data || rows.some(r => r.pending)} onClick={() => {
        if (!news.data) return
        try { downloadNews({ ...news.data, rows }, scope, date); setCopied({ context, message: 'Markdown download requested.' }) }
        catch { setCopied({ context, message: 'Could not export Markdown. Please retry.' }) }
      }}>Export Markdown</button>
    </header>
    <p className="news-help">{today ? 'Today · on-demand research. Lookback applies to the next refresh request.' : 'Saved research · browsing this date does not run research.'} Each currency keeps its own saved, publication and check times · Jakarta, AM/PM.</p>
    <p className="news-copy-status" role="status">{copied?.context === context ? copied.message : ''}</p>
    {news.error && <p className="news-error" role="alert">{news.error}{news.data ? ' Showing the last loaded news with its original check times.' : ''}</p>}
    {!news.data && !news.error && <p role="status">Loading saved news…</p>}
    <div className="news-scroll" tabIndex={0} aria-label="Currency news table">
      <table className="currency-news-table"><thead><tr><th>Currency</th><th>Saved verified information · Jakarta, AM/PM</th><th>Fundamental implication</th><th>Sources</th></tr></thead>
        <tbody>{rows.filter(r => scope === 'ALL' || scope === r.currency).map(row => <CurrencyRow key={row.currency} today={today} row={row} status={news.data ? undefined : news.error ? 'unavailable' : 'loading'} select={news.select} />)}</tbody>
      </table>
    </div>
  </section>
})
