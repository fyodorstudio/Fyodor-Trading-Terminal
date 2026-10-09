import { useMemo, useState } from 'react'
import type { ComboSnapshot } from '../../../scoring-system/relationships/contracts'
import { auditWindows, auditVerdicts, roofAuditScope, sameRoofAudit } from '../audit/audit-model'
import { useRoofAudits, saveRoofObservation } from '../audit/audit-storage'
import type { RelationshipSupport } from '../../../scoring-system/relationships/relationship-support'
import { roofSupport } from '../../../scoring-system/relationships/relationship-support'
import { useDisplayClock } from '../../../appearance/time-display/useDisplayClock'

export function RoofAuditControls({ combo, symbol, broker, support }: { combo: ComboSnapshot; symbol: string; broker: string | null; support?: RelationshipSupport }) {
  const records = useRoofAudits(), [notice, setNotice] = useState<{ snapshot: string; message: string } | null>(null)
  const scope = useMemo(() => roofAuditScope(combo, symbol, broker, support), [combo, symbol, broker, support])
  const clock = useDisplayClock()
  const displayed = support ?? roofSupport(combo)
  const hasDirection = displayed.state !== 'insufficient' && displayed.direction !== null
  const current = records.find(record => sameRoofAudit(record, scope))
  const previous = !current && records.some(record => record.broker === broker && record.symbol === symbol && record.comboId === combo.id)
  return <section className="combo-audit" aria-label="Manual price audit">
    <h3>What did price do?</h3>
    <p>Compare with this roof’s direction. Start with the H1 candle containing the activation time, then count subsequent trading candles separately.</p>
    <small>Read from {clock.chart(combo.chartAt)} ({clock.zone}). Compare only price after this exact time; the containing candle can include earlier trading. Saved with this reading’s support split and input configuration.</small>
    {!hasDirection && <p>This reading has no directional lead. Record Unclear; Aligned/Opposed need a leading side.</p>}
    {auditWindows.map(window => <div className="combo-audit-row" key={window.id}>
      <strong>{window.label}</strong>
      <div role="group" aria-label={window.label}>{auditVerdicts.map(verdict => <button type="button" key={verdict}
        disabled={!hasDirection && verdict !== 'Unclear'}
        aria-pressed={current?.observations[window.id] === verdict} onClick={() => {
          const persisted = saveRoofObservation(scope, window.id, current?.observations[window.id] === verdict ? null : verdict)
          setNotice({ snapshot: scope.snapshot, message: persisted ? 'Saved locally. Click the selected label again to clear it.' : 'Kept for this session; browser storage is unavailable.' })
        }}>{verdict}</button>)}</div>
    </div>)}
    {previous && <p>Earlier observations used a different interpretation or input configuration. This result starts unaudited.</p>}
    <small role="status">{(notice?.snapshot === scope.snapshot ? notice.message : '') || (current ? 'Recorded for this broker, pair and interpretation snapshot.' : 'Optional manual observations; these never adjust the scoring rules.')}</small>
  </section>
}
