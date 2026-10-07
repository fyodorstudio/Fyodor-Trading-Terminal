import { useEffect, useRef } from 'react'
import { saveSequencePreferences, useSequencePreferences } from '../storage/sequence-preferences'
import { saveRelativePreferences, useRelativePreferences } from '../../../pair-context/storage/relative-preferences'
import { useRaycasterFamilies } from '../../../raycaster/storage/raycaster-family-settings'
import './roof-guide.css'

export function RoofGuide({ onClose, relativeSupported }: { onClose: () => void; relativeSupported: boolean }) {
  const panel = useRef<HTMLDivElement>(null)
  const preferences = useSequencePreferences(), relative = useRelativePreferences()
  const families = useRaycasterFamilies()
  useEffect(() => {
    panel.current?.focus()
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  return <div ref={panel} tabIndex={-1} role="dialog" aria-label="Roof and ribbon guide" className="roof-guide">
    <header><strong>Roofs &amp; context ribbon</strong><button type="button" onClick={onClose} aria-label="Close roof guide">×</button></header>
    <section><h3>Read the shapes</h3>
      <p>The endpoint tagged Starts marks activation: when all required information was available. Update marks a memory change without a new publication. The line connects source releases to activation; its width is not an active duration or a holding period.</p>
      <p>Three lanes keep labels apart. Focused prioritizes evidence and removes repetition; More keeps every omitted roof accessible. Click a roof to inspect its dated explanation.</p>
      <p>Release symbols sit on each of the three roof levels. Click a symbol for its release, or a counted symbol to choose among nearby releases. Click the direction box for Combo details. Panning preserves the anchors and lanes; screen edges clip them. Zooming, new history or changed inputs can rearrange the layout and symbol clusters.</p></section>
    <section><h3>Available USD relationships</h3><dl>
      <dt>ISM sectors</dt><dd>Manufacturing and Services resolve the existing ISM vote together.</dd>
      <dt>Labor + inflation</dt><dd>Confirmed labor weakness takes priority when the inflation guard conditions allow it.</dd>
      <dt>Claims + NFP</dt><dd>Persistent weekly claims can challenge an older weak or incomplete jobs report.</dd>
      <dt>Fresh news · Experimental</dt><dd>Replacement effects over seven days align across at least two economic domains. This has Weak evidence and is separate from accumulated context.</dd>
    </dl><label><input type="checkbox" checked={preferences.fresh} onChange={e => saveSequencePreferences({ ...preferences, fresh: e.target.checked })} /> Show experimental fresh-news roofs</label></section>
    <section><h3>Inputs and scope</h3>
      <p>Roofs use enabled USD CPI, NFP, Claims, PCE, PPI, ISM, Retail Sales and GDP inputs. Fed decisions and speeches add no extra roof vote. EUR publications do not participate in these USD roofs.</p>
      <ul>{['cpi', 'nfp', 'claims', 'pce', 'ppi', 'ism', 'retail', 'gdp'].map(f => <li key={f}>{f.toUpperCase()}: {families.some(enabled => enabled === f) ? 'Enabled' : 'Off'}</li>)}</ul>
      <p>Raycaster’s context inputs determine calculation. Inspector’s filters determine visible symbols; hidden source symbols are disclosed on roofs. Turning a view off does not change the math.</p></section>
    <section><h3>Raycaster Candy · Context ribbon</h3>
      <label>Context mode <select value={relativeSupported ? relative.mode : 'usd'} onChange={e => saveRelativePreferences({ ...relative, mode: e.target.value as 'usd' | 'relative' })}>
        <option value="usd">USD side</option>{relativeSupported && <option value="relative">EUR vs USD</option>}</select></label>
      <p>The ribbon and hover box share this mode and their context inputs. Green means pair Long; red means pair Short. Pale / medium / deep shades show Weak / Moderate / Strong evidence. Gray means unavailable, not neutral.</p>
      <p>A segment lasts until the next context update. Hover for its exact time and responsible update; click for sources. Publication, aging and expiry updates are distinguished. Evidence is rule agreement, not a winning probability.</p></section>
    <section><h3>Outside events · Manual gray strip</h3>
      <p>Use Outside events + above Candy to record an event title, chart-clock window and observation. Hover or click a gray highlight to review it. Notes belong to this broker and pair, save locally and travel with workspace backups.</p>
      <p>Gray highlights are manually selected windows outside our dataset. They add no directional vote and do not prove what caused a price move. Retrospective notes keep their recording date.</p></section>
  </div>
}
