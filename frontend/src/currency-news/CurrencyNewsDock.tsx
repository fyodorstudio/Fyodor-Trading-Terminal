import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { newsCurrencies, newsTime, newsAge, storyDate, refreshPrompt, type NewsCurrency, type NewsStory } from './news-model'
import { useNewsDay } from './useNewsDay'
import { downloadNews } from './news-export'
import { AlertDateSelector } from '../alert/dock/AlertDateSelector'
import { jakartaDate } from '../alert/model/alert-day-model'
import './currency-news.css'

function RelativeTime({ at, label = '' }: { at: string; label?: string }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [at])
  return <span className="news-age" title={`${label}${newsTime(at)}`}>{label}{newsAge(at, now)}</span>
}
const biasLabels = { bullish: 'Bullish', bearish: 'Bearish', conditional: 'Conditional', neutral: 'No clear directional bias' }
type StoryProps = { story: NewsStory; scope: NewsCurrency | 'ALL'; select: ReturnType<typeof useNewsDay>['select'] }
const StoryRow = memo(function StoryRow({ story, scope, select }: StoryProps) {
  return <tr data-news-story={story.id}>
    <th scope="row">
      <div className="news-tags">{story.implications.map(i => <span key={i.currency}>{i.currency}</span>)}</div>
      <RelativeTime at={story.order_at} label={story.published_at ? '' : 'Assessed '} />
      <div className="news-sources">{story.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>)}</div>
    </th>
    <td><time className="news-publication" dateTime={story.published_at ?? story.published_date}>{storyDate(story)}</time><p className="news-headline">{story.summary}</p></td>
    <td>{story.implications.filter(i => scope === 'ALL' || i.currency === scope).map(i => <div className="news-comment" key={i.currency} data-news-implication={i.currency}>
      <span className={`news-implication ${i.bias}`}><i aria-hidden="true" />{story.implications.length > 1 && `${i.currency} · `}{i.bias === 'conditional' && i.bullish_if && i.bearish_if ? 'Scenarios' : biasLabels[i.bias]}</span>
      {i.pending ? <p role="status">Loading earlier assessment…</p> : <>
        {i.bias === 'conditional' && i.bullish_if && i.bearish_if && <><p><strong>Bullish if</strong> {i.bullish_if}</p><p><strong>Bearish if</strong> {i.bearish_if}</p></>}
        <p>{i.reason}</p>
        {i.coverage_note && <p className="news-note">{i.coverage_note}</p>}
      </>}
      {i.versions.length > 1 && <select className="news-assessment" aria-label={`${story.id} ${i.currency} assessment`} value={i.selected_run ?? i.versions[0].run_id} onChange={event => select(story.id, i.currency, event.target.value === i.versions[0].run_id ? null : i.versions.find(v => v.run_id === event.target.value)!)}>
        {i.versions.map((v, index) => <option key={v.run_id} value={v.run_id}>{index === 0 ? 'Latest assessment' : newsTime(v.assessed_at)}</option>)}
      </select>}
    </div>)}</td>
  </tr>
})
function savedScope(): NewsCurrency | 'ALL' {
  try { const value = localStorage.getItem('fyodor.currency-news.scope.v1'); if (value === 'ALL' || newsCurrencies.includes(value as NewsCurrency)) return value as NewsCurrency | 'ALL' } catch { /* Session defaults. */ }
  return 'ALL'
}
export const CurrencyNewsDock = memo(function CurrencyNewsDock() {
  const [scope, setScope] = useState(savedScope)
  const [copied, setCopied] = useState<{ context: string; message: string } | null>(null)
  const [limit, setLimit] = useState(50)
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
  const stories = useMemo(() => news.stories.filter(s => scope === 'ALL' || s.implications.some(i => i.currency === scope)), [news.stories, scope])
  const context = `${date}:${scope}`
  const changeDate = useCallback((value: string) => { setLimit(50); setCalendar(old => ({ ...old, date: value })) }, [])
  async function copy() {
    if (date !== jakartaDate(Date.now())) return
    try { await navigator.clipboard.writeText(refreshPrompt(scope)); setCopied({ context, message: 'Refresh prompt copied. Run it in your agent chat.' }) }
    catch { setCopied({ context, message: 'Could not copy the prompt. Allow clipboard access and retry.' }) }
  }
  function select(value: NewsCurrency | 'ALL') {
    setScope(value); setLimit(50)
    try { localStorage.setItem('fyodor.currency-news.scope.v1', value) } catch { /* Retain session choice. */ }
  }
  const coverage = news.data?.coverage.filter(c => scope === 'ALL' || c.currency === scope) ?? []
  return <section className="currency-news-dock" aria-label="Currency News">
    <header className="currency-news-header">
      <h2>Currency News</h2>
      <AlertDateSelector date={date} onChange={changeDate} label="Currency News" />
      <div className="news-currencies" role="group" aria-label="News currency">
        {(['ALL', ...newsCurrencies] as const).map(c => <button key={c} type="button" aria-pressed={scope === c} onClick={() => select(c)}>{c === 'ALL' ? 'All' : c}</button>)}
      </div>
      {today && <button type="button" onClick={() => { void copy() }}>Copy refresh prompt</button>}
      <button type="button" onClick={news.reload}>Reload saved news</button>
      <button type="button" disabled={!news.data || news.stories.some(s => s.implications.some(i => i.pending))} onClick={() => {
        if (!news.data) return
        try { downloadNews({ ...news.data, stories: news.stories }, scope, date); setCopied({ context, message: 'Markdown download requested.' }) }
        catch { setCopied({ context, message: 'Could not export Markdown. Please retry.' }) }
      }}>Export Markdown</button>
      {news.data?.updated_at && <RelativeTime at={news.data.updated_at} label="Last updated " />}
    </header>
    <p className="news-copy-status" role="status">{copied?.context === context ? copied.message : ''}</p>
    {news.error && <p className="news-error" role="alert">{news.error}{news.data ? ' Showing the last loaded news.' : ''}</p>}
    <div className="news-scroll" tabIndex={0} aria-label="Currency news table" onScroll={event => {
      const element = event.currentTarget
      if (element.scrollHeight - element.scrollTop - element.clientHeight < 200 && limit < stories.length) setLimit(n => n + 50)
    }}>
      <table className="currency-news-table"><thead><tr><th>Currencies / Sources</th><th>News Fundamentals</th><th>Implication</th></tr></thead>
        <tbody>{stories.slice(0, limit).map(story => <StoryRow key={story.id} story={story} scope={scope} select={news.select} />)}
          {!stories.length && <tr><td colSpan={3}>{!news.data ? news.error ? 'Saved research unavailable.' : 'Loading saved news…' : 'No news fundamentals saved for this date.'}
            {coverage.map(c => <p key={c.currency}>{c.currency}: {c.note || 'No stories saved.'}</p>)}
          </td></tr>}
        </tbody>
      </table>
      {stories.length > limit && <button className="news-more" type="button" onClick={() => setLimit(n => n + 50)}>Show more news</button>}
    </div>
  </section>
})
