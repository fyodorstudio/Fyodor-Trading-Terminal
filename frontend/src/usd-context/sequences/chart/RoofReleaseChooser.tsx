import { useEffect, useRef } from 'react'
import { symbolGlyph } from '../../../inspector/event-symbols'
import type { ComboSource } from '../core/contracts'
import type { RoofEndpoint } from './roof-symbols'

export function RoofReleaseChooser({ endpoint, left, trigger, onClose, onOpen }: {
  endpoint: RoofEndpoint; left: number; trigger: HTMLButtonElement;
  onClose: () => void; onOpen: (source: ComboSource) => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); trigger.focus({ preventScroll: true }) } }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [onClose, trigger])
  return <div ref={panel} tabIndex={-1} role="dialog" aria-label="Choose a roof release" className="combo-roof-release-chooser" style={{ left }}>
    <header><strong>Releases at this point</strong><button type="button" onClick={() => { onClose(); trigger.focus({ preventScroll: true }) }}>Close</button></header>
    {endpoint.publications.map(({ source, symbol }) => <button type="button" key={source.sourceId} onClick={() => { onClose(); onOpen(source) }}>
      <span className="combo-roof-glyph">{symbolGlyph(symbol)}</span> {source.sourceLabel}
      <small>{new Date(source.chartAt).toISOString().slice(0, 16).replace('T', ' ')} · broker time</small>
    </button>)}
  </div>
}
