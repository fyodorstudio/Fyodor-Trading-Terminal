import { useEffect, useRef } from 'react'
import type { RibbonPoint } from './ribbon-timeline'
import { brokerClock } from './broker-clock'

export function RibbonExplanation({ point, mode, version, partial, onClose }: { point: RibbonPoint; mode: string; version: string; partial: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  return <div ref={panel} tabIndex={-1} role="dialog" aria-label="Context ribbon explanation" className="ribbon-explanation">
    <header><strong>{point.label} · {point.evidence ?? 'Unavailable'} evidence</strong><button type="button" onClick={onClose} aria-label="Close ribbon explanation">×</button></header>
    <p>{mode} · {version}{partial ? ' · Partial or timing-excluded history' : ''}</p><p>State available from {brokerClock(point.at)}</p>
    <p>{point.explanation}</p><h3>{point.kind === 'publication' ? 'Publication update' : point.kind === 'expiry' ? 'Expiry update' : 'Memory aging update'}</h3><p>{point.update}</p>
    <h3>USD contributions at this time</h3><table><thead><tr><th>Input / latest source</th><th>Status</th><th>Vote</th></tr></thead><tbody>
      {point.usd?.result.members.map(m => <tr key={m.family}><td>{m.sourceLabel}<small>{brokerClock(m.chartAt)}</small></td><td>{m.status}</td><td>{m.contribution.toFixed(3)}</td></tr>)}
    </tbody></table>
    {mode === 'EUR vs USD' && <><h3>EUR contributions at this time</h3><table><thead><tr><th>Input / source</th><th>Status</th><th>Vote</th></tr></thead><tbody>
      {point.eur?.members.map(m => <tr key={m.slot}><td>{m.label}<small>{brokerClock(m.chartAt)}</small></td><td>{m.status}</td><td>{m.contribution.toFixed(3)}</td></tr>)}
    </tbody></table></>}
    <p>Missing inputs stay missing. These are stored numerical interpretations, not a price forecast. A later configuration change rebuilds this view; it is not a new publication.</p>
  </div>
}
