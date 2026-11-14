import { useMemo } from 'react'
import { useWildcards } from './useWildcards'
import { wildcardsAt } from './wildcard-model'
import { useDisplayClock } from '../appearance/time-display/useDisplayClock'

export function DetailWildcards({ at, pinned }: { at: number; pinned: boolean }) {
  const { snapshot, error, openEntry } = useWildcards()
  const { utc } = useDisplayClock()
  const items = useMemo(() => wildcardsAt(snapshot?.items ?? [], at, pinned), [snapshot?.items, at, pinned])
  return <section className="detail-wildcards" aria-label="Detail Wildcards"><strong>Wildcards</strong><small>{pinned ? 'Preceding seven days' : 'Selected day'} · up to selected time</small>
    {error && <p role="alert">{error}</p>}{items.map(entry => <button type="button" key={entry.id} onClick={() => openEntry(entry)}><strong>{entry.title}</strong><small>{entry.at ? utc(Date.parse(entry.at)) : `${entry.date} · Date only`}</small><p>{entry.details}</p></button>)}
    {!items.length && <p>{snapshot ? 'No wildcards in this period.' : 'Loading Wildcards…'}</p>}
  </section>
}
