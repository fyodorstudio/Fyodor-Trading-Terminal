import { useEffect, useRef } from 'react'
import type { RibbonPoint } from './ribbon-timeline'
import { useDisplayClock } from '../../appearance/time-display/useDisplayClock'
import { UsdSupportDetails } from '../ui/UsdSupportDetails'
import { RelationshipSupport } from '../../usd-context/sequences/ui/RelationshipSupport'
import { RoofAuditControls } from '../../usd-context/sequences/ui/RoofAuditControls'
import { usdContextPresentation } from '../core/usd-context-presentation'

export function RibbonExplanation({ point, mode, version, partial, onClose, symbol = '', brokerId = null }: { point: RibbonPoint; mode: string; version: string; partial: boolean; onClose: () => void; symbol?: string; brokerId?: string | null }) {
  const panel = useRef<HTMLDivElement>(null)
  const clock = useDisplayClock(), displayClock = clock.chart
  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  if (point.relationship) {
    const p = point.relationship
    const fed = p.snapshot.sources.find(source => source.family === 'fed')
    const accumulated = usdContextPresentation(symbol, point.usd?.result, p.at)
    return <div ref={panel} tabIndex={-1} role="dialog" aria-label="Selected relationship explanation" className="ribbon-explanation">
      <header><strong>{p.snapshot.title} · {p.label}</strong><button type="button" onClick={onClose} aria-label="Close ribbon explanation">×</button></header>
      <p>{p.snapshot.kind === 'fresh-news' ? 'Recent support change' : 'Relationship support'} · USD inputs · available from {displayClock(p.at)} ({clock.zone})</p>
      <RelationshipSupport support={p.support} calculations={false} />
      <small>{p.evidence ? `${p.evidence} evidence` : 'No directional lead'}</small>
      <p>{p.explanation}</p><p>{p.update}</p>
      {fed && <p>Fed action: {fed.policyAction?.action ?? 'Unavailable'}. Separate from the macro percentages.{p.actionConflict ? ' The action opposes the macro lead.' : ''}</p>}
      {p.support.missing.length > 0 && <p>Unavailable: {p.support.missing.join(', ')}.</p>}
      <h3>Accumulated USD context at the same time</h3><strong>{accumulated.label}</strong>
      <UsdSupportDetails presentation={accumulated} compact />
      <RoofAuditControls combo={p.snapshot} support={p.support} symbol={symbol} broker={brokerId} />
      <details><summary>Calculations and sources</summary><p>{version}{partial ? ' · Partial history' : ''}</p>
        <RelationshipSupport support={p.support} />
        <table><thead><tr><th>Input</th><th>USD vote</th></tr></thead><tbody>{p.support.votes.map(v => <tr key={v.source.sourceId}><td>{v.source.sourceLabel}</td><td>{v.vote.toFixed(3)}</td></tr>)}</tbody></table>
        <p>The selected relationship follows latest known inputs. The original roof remains a snapshot at activation.</p>
      </details>
    </div>
  }
  return <div ref={panel} tabIndex={-1} role="dialog" aria-label="Context ribbon explanation" className="ribbon-explanation">
    <header><strong>{point.label}{point.evidence ? ` · ${point.evidence} evidence` : ''}</strong><button type="button" onClick={onClose} aria-label="Close ribbon explanation">×</button></header>
    <p>{mode} · {version}{partial ? ' · Partial or timing-excluded history' : ''}</p><p>State available from {displayClock(point.at)} ({clock.zone})</p>
    <p>{point.explanation}</p><h3>{point.kind === 'publication' ? 'New publication' : point.kind === 'expiry' ? 'Expiry update' : 'Aging update'}</h3><p>{point.update}</p>{point.kind !== 'publication' && <p>No new publication. Existing evidence changed through {point.kind === 'expiry' ? 'expiry' : 'aging'}.</p>}
    {mode === 'USD side' && point.presentation && <UsdSupportDetails presentation={point.presentation} />}
    <h3>USD contributions at this time</h3><table><thead><tr><th>Input / latest source</th><th>Status</th><th>Vote</th></tr></thead><tbody>
      {point.usd?.result.members.map(m => <tr key={m.family}><td>{m.sourceLabel}<small>{displayClock(m.chartAt)}</small></td><td>{m.status}</td><td>{m.contribution.toFixed(3)}</td></tr>)}
    </tbody></table>
    {mode === 'EUR vs USD' && <><h3>EUR contributions at this time</h3><table><thead><tr><th>Input / source</th><th>Status</th><th>Vote</th></tr></thead><tbody>
      {point.eur?.members.map(m => <tr key={m.slot}><td>{m.label}<small>{displayClock(m.chartAt)}</small></td><td>{m.status}</td><td>{m.contribution.toFixed(3)}</td></tr>)}
    </tbody></table></>}
  </div>
}
