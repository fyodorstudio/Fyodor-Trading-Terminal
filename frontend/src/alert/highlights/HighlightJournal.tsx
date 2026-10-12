import { memo } from 'react'
import { formatInspectorValue } from '../../inspector/readings/reading-values'
import type { Highlight, JournalEntry } from './highlight-model'

function Entry({ entry }: { entry: JournalEntry }) {
  return <section className="highlight-journal-entry" data-journal-id={entry.id}>
    <p className="highlight-research-meta">{entry.scope} · Researched as of {entry.as_of_utc}
      {entry.correction_of && ` · Correction of ${entry.correction_of}`}</p>
    <p><strong>{entry.direction}</strong> · Confidence: {entry.confidence}</p>
    <div className="highlight-research-body">{entry.body.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    <p><strong>Strongest counterevidence:</strong> {entry.counterevidence}</p>
    {entry.price_reaction && <p><strong>Measured price reaction:</strong> {entry.price_reaction}</p>}
    {entry.trade_outcome && <p><strong>User-provided trade outcome:</strong> {entry.trade_outcome}</p>}
    <details><summary>Sources and captured evidence</summary>
      {entry.expectations.length > 0 && <ul>{entry.expectations.map((expectation, index) => <li key={index}>
        <strong>{expectation.provider}</strong> · {expectation.as_of_utc}: {expectation.values}</li>)}</ul>}
      <ul>{entry.sources.map((source, index) => <li key={index}>
        {source.kind === 'web' && /^https?:\/\//i.test(source.locator)
          ? <a href={source.locator} target="_blank" rel="noopener noreferrer">{source.label}</a>
          : <><strong>{source.label}</strong><code>{source.locator}</code></>}
        {source.note && <p>{source.note}</p>}</li>)}</ul>
      <p className="highlight-research-meta">Saved {entry.saved_utc} · Calendar revision {entry.calendar_revision}. {entry.reading_vintage}</p>
      {entry.prior_highlight_ids.length > 0 && <p>Prior investigations: {entry.prior_highlight_ids.join(', ')}</p>}
      <div className="highlight-series"><table aria-label="Research snapshot readings">
        <thead><tr><th>Series</th><th>Actual</th><th>Forecast</th><th>Previous</th><th>Revised previous</th></tr></thead>
        <tbody>{entry.readings.map(event => <tr key={event.value_id}><th scope="row">{event.name}
          <small>Value {event.value_id} · revision {event.revision} · {event.availability}</small></th>
          {[event.actual, event.forecast, event.previous, event.revised_previous].map((value, index) => <td key={index}>{formatInspectorValue(value, event)}</td>)}
        </tr>)}</tbody></table></div>
      {entry.missing_value_ids.length > 0 && <p>Missing readings: {entry.missing_value_ids.join(', ')}</p>}
    </details>
  </section>
}

export const HighlightJournal = memo(function HighlightJournal({ item, scope }: { item: Highlight; scope: string }) {
  const entries = (item.journal ?? []).filter(entry => entry.scope === scope)
  const latest = (phase: 'before' | 'after') => [...entries].reverse().find(entry => entry.phase === phase)
  return <div className="highlight-journal" aria-label={`${scope} fundamental research journal`}>
    {(['before', 'after'] as const).map(phase => <section key={phase}>
      <h4>{phase === 'before' ? 'Before release' : 'After release'}</h4>
      {latest(phase) ? <Entry entry={latest(phase)!} /> : <p className="highlight-research-meta">
        {phase === 'before' ? 'No saved research for this scope.' : 'No saved interpretation. Release readings and research must be verified.'}</p>}
    </section>)}
    {entries.length > 0 && <details><summary>Research history ({entries.length} versions)</summary>
      {[...entries].reverse().map(entry => <details key={entry.id}><summary>{entry.phase === 'before' ? 'Before' : 'After'} release · {entry.as_of_utc}</summary>
        <Entry entry={entry} /></details>)}
    </details>}
  </div>
})
