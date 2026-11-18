import { useEffect, useRef, useState } from 'react'
import type { NewsSettings } from './model'
import { KeywordTags } from './KeywordTags'
import { defaultFilterPolicy, encodeFilterPolicy, keywordGroups, type NewsFilterPolicy } from './filter-policy'

const filters: [keyof NewsFilterPolicy, string, string][] = [
  ['other_markets', 'Hide other-market domestic news', 'Applies only to the keywords below. Traded-market exceptions can keep a story relevant.'],
  ['crypto_only', 'Hide crypto-only stories', 'Retains headlines with explicit transmission to your traded markets or known index companies.'],
  ['retail_quotes', 'Hide local retail gold/silver quotes', 'Retains supply, demand, duties, imports, exports and reserve developments.'],
  ['non_market', 'Hide non-market and consumer topics', 'Sports, entertainment and product-use stories; material company events can still qualify.'],
  ['routine', 'Hide routine personnel, promotions and agency notices', 'Low-level hiring, broker promotions, corporate invitations, boilerplate single-stock daily recaps and Treasury crime/cartel notices without a market driver. Material company news, Treasury meeting readouts and policy speeches stay eligible.'],
  ['metadata', 'Hide quote pages and routine filings', 'Stock-quote/category pages, tag pages, Form 4/8.3 notices and routine share-count announcements.'],
  ['subject_context', 'Check the actual market subject', 'Avoid treating a quoted USD amount, Dollar Tree/General, NASDAQ exchange label, analyst bank name or sales/clinical pipeline as the story’s market subject.'],
  ['broad_context', 'Require market context for broad keywords', 'Broad words such as Japan, AI, stock and earnings need market context. Turn off to let those Include matches qualify directly.'],
  ['protect_official', 'Keep verified official releases', 'Protect central-bank policy/speeches and relevant statistical, funding, intervention and sanctions releases, even without an Include keyword.'],
  ['protect_remarks', 'Keep policy remarks from financial sources', 'Recognize target-country quoted policy remarks and observed policy-speaker aliases from verified financial news sources.'],
  ['cross_market', 'Keep cross-market drivers', 'Protect the exception keywords below, explicit moves in your eight currencies, target-country macro releases, semiconductor-policy events, AI risk, geopolitical developments and systemic stress from the other-market filter.'],
]

export function NewsAutomaticFilters({ settings, onChange }: { settings: NewsSettings; onChange: (value: NewsSettings) => void }) {
  const [error, setError] = useState(''), [title, setTitle] = useState('')
  const policy = settings.automaticFilters
  const scope = JSON.stringify({ include: settings.include, exclude: settings.exclude, market_relevance: settings.marketRelevance, filter_policy: encodeFilterPolicy(policy) })
  function update(next: NewsFilterPolicy) {
    if (encodeFilterPolicy(next).length > 16000) { setError('Automatic filter settings exceed 16000 characters. Shorten the keyword lists.'); return }
    setError(''); onChange({ ...settings, automaticFilters: next })
  }
  return <fieldset className="news-automatic-filters"><legend>Automatic relevance filters · all providers</legend>
    <p>These rules refine keyword matching when Trading relevance is on. Every optional filter and protection is listed here. Explicit Exclude always wins. Turning off Trading relevance bypasses all these rules.</p>
    {!settings.marketRelevance && <p role="status">Automatic filters are bypassed. Include/Exclude keywords control relevance.</p>}
    <div className="news-filter-switches">{filters.map(([key, label, description]) => <div key={key}><label className="news-checkbox"><input type="checkbox" aria-label={label} checked={policy[key] === true} disabled={!settings.marketRelevance} onChange={event => update({ ...policy, [key]: event.target.checked })} />{label}</label><p>{description}</p></div>)}</div>
    <KeywordTags label="Other-market filter" value={policy.other_market_terms} onChange={other_market_terms => update({ ...policy, other_market_terms })} />
    <p>Only used by “Hide other-market domestic news”. This list matches literal whole words/phrases; related spellings are listed separately.</p>
    <KeywordTags label="Other-market exceptions" value={policy.exceptions} groups={keywordGroups} onChange={exceptions => update({ ...policy, exceptions })} />
    <p>This list matches literal whole words/phrases. Exceptions protect an already matching headline from the other-market filter when “Keep cross-market drivers” is on. They do not bypass Exclude, crypto-only, routine-notice or quote-page filters. Treasury protects a Treasury sell-off story even when Indonesia is mentioned.</p>
    <button type="button" aria-label="Reset automatic filters" onClick={() => update({ ...defaultFilterPolicy })}>Reset automatic filters</button>
    <HeadlineCheck key={scope} scope={scope} title={title} onTitle={setTitle} />
    {error && <p role="alert">{error}</p>}
  </fieldset>
}

function HeadlineCheck({ scope, title, onTitle }: { scope: string; title: string; onTitle: (value: string) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [result, setResult] = useState<{ relevance: { tier: string; reason: string; priority_reason?: string }; matched_include: string[]; matched_exclude: string[] } | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  async function check() {
    const controller = new AbortController(); request.current?.abort(); request.current = controller
    setBusy(true); setResult(null); setError('')
    try {
      const response = await fetch('/storage-api/news-flow/classify', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...JSON.parse(scope), title: title.trim() }) })
      if (!response.ok) throw Error('Could not check this headline. Check the local service and filter settings.')
      const data = await response.json()
      if (!data?.relevance || !['priority', 'included', 'excluded'].includes(data.relevance.tier) || typeof data.relevance.reason !== 'string' || !Array.isArray(data.matched_include) || !Array.isArray(data.matched_exclude) || ![...data.matched_include, ...data.matched_exclude].every(term => typeof term === 'string')) throw Error('Invalid headline check response.')
      if (!controller.signal.aborted) setResult(data)
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Headline check failed.') }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  return <form className="news-headline-check" onSubmit={event => { event.preventDefault(); if (title.trim() && !busy) void check() }}>
      <label>Check a headline<input aria-label="Check headline text" maxLength={2000} value={title} placeholder="Paste a headline to see its keyword matches and decision" onChange={event => { request.current?.abort(); setBusy(false); setResult(null); setError(''); onTitle(event.target.value) }} /></label>
      <button type="submit" aria-label="Check headline" disabled={!title.trim() || busy}>{busy ? 'Checking…' : 'Check headline'}</button>
      <p>Checks text only; official-source protections need the original feed/article context. This never fetches an article or sends an alert.</p>
      {result && <div role="status"><strong>{result.relevance.tier === 'priority' ? 'Priority (also Included)' : result.relevance.tier === 'included' ? 'Included' : 'Excluded'}</strong><p>{result.relevance.reason}{result.relevance.priority_reason ? ` · ${result.relevance.priority_reason}` : ''}</p><p>Include matches: {result.matched_include.join(', ') || 'None'}<br />Exclude matches: {result.matched_exclude.join(', ') || 'None'}</p></div>}
    {error && <p role="alert">{error}</p>}
    </form>
}
