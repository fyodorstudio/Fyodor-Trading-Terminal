import type { InspectorScoringProps } from '../../../../scoring-contracts'
import { PublicationScoringLayout } from '../../../../shared/ui/PublicationScoringLayout'
import { PublicationScoringContext } from '../../../../shared/ui/PublicationScoringContext'
import { pmiSectionLabel, pmiSourceRelease } from '../../../../../episodes/pmi-episodes'
import { formatAppTimestamp } from '../../../../../../appearance/time-display/time-display-preference'
import { EurScore } from './EurScore'

/** Three original interpreters; one context view at the latest known publication. */
export function PmiEpisodeScore(props: InspectorScoringProps) {
  const latest = pmiSourceRelease(props.release, null, props.now ?? Infinity)
  if (!latest) return null
  const display = props.timeDisplay ?? { mode: 'utc', utcOffsetMinutes: 0 }
  return <PublicationScoringLayout label="Grouped Euro-area PMI scoring" standalone={<>
    {props.release?.pmiPublications?.map(member => <section key={member.id} aria-label={`${pmiSectionLabel(member)} PMI scoring`}>
      <h3>{pmiSectionLabel(member)} · {member.releaseAt === null ? 'Time unavailable' : formatAppTimestamp(member.releaseAt, display)}</h3>
      <EurScore {...props} release={member} now={member.releaseAt !== null && member.releaseAt <= (props.now ?? Infinity) ? member.releaseAt : 0} />
      {props.onOpenScatter && <button type="button" onClick={() => props.onOpenScatter!(member)}>Open {pmiSectionLabel(member)} in Scatter Plot</button>}
    </section>)}
    <p>One publication round. Each section keeps its own release-only interpretation; these are not three independent euro-area votes.</p>
  </>} context={<>
    <PublicationScoringContext {...props} release={latest} />
    <p>Context shown at the latest available publication in this round: {pmiSectionLabel(latest)}. France and Germany supply earlier proxies; the euro-area aggregate replaces overlapping proxies for the same reference month under the existing rules.</p>
  </>} />
}
