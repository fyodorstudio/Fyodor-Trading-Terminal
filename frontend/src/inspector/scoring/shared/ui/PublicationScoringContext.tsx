import type { ReactNode } from 'react'
import type { InspectorScoringProps } from '../../scoring-contracts'
import type { InspectorEvent } from '../../../inspector-data'
import { PublicationContext } from '../../../../usd-context/ui/PublicationContext'
import { RelativePublicationContext } from '../../../../pair-context/ui/RelativePublicationContext'
import { useRelativePreferences } from '../../../../pair-context/storage/relative-preferences'
import { ContextViewSelector } from '../../../../pair-context/ui/ContextViewSelector'
import { formatAppTimestamp } from '../../../../appearance/time-display/time-display-preference'

/** Both currency legs stay inside the context column; the release stays separate. */
export function PublicationScoringContext({ children, ...props }: Omit<InspectorScoringProps, 'events'> & {
  children?: (controls: ReactNode) => ReactNode; events?: readonly InspectorEvent[]
}) {
  const preferences = useRelativePreferences()
  if (!props.release) return null
  const controls = <div className="publication-context-controls">
    <p className="publication-context-cutoff">Publication cutoff: {props.release.releaseAt === null ? 'Unverified' :
      formatAppTimestamp(props.release.releaseAt, props.timeDisplay ?? { mode: 'utc', utcOffsetMinutes: 0 })}</p>
    <ContextViewSelector supported label={preferences.mode === 'relative' ? 'Raycaster context view' : 'Publication context view'} />
  </div>
  const usdControls = preferences.mode === 'relative' ? null : controls
  return <>
    {preferences.mode === 'relative' && <RelativePublicationContext {...props} controls={controls} />}
    {children ? children(usdControls) : <PublicationContext {...props} release={props.release} controls={usdControls} />}
  </>
}
