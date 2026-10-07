import { useMemo, useState } from 'react'
import type { ComboSnapshot } from '../core/contracts'
import { auditWindows, auditVerdicts, roofAuditScope, sameRoofAudit } from '../audit/audit-model'
import { useRoofAudits, saveRoofObservation } from '../audit/audit-storage'

export function RoofAuditControls({ combo, symbol, broker }: { combo: ComboSnapshot; symbol: string; broker: string | null }) {
  const records = useRoofAudits(), [notice, setNotice] = useState<{ snapshot: string; message: string } | null>(null)
  const scope = useMemo(() => roofAuditScope(combo, symbol, broker), [combo, symbol, broker])
  const current = records.find(record => sameRoofAudit(record, scope))
  const previous = !current && records.some(record => record.broker === broker && record.symbol === symbol && record.comboId === combo.id)
  return <section className="combo-audit" aria-label="Manual price audit">
    <h3>What did price do?</h3>
    <p>Compare with this roof’s direction. Start with the H1 candle containing the activation time, then count subsequent trading candles separately.</p>
    {auditWindows.map(window => <div className="combo-audit-row" key={window.id}>
      <strong>{window.label}</strong>
      <div role="group" aria-label={window.label}>{auditVerdicts.map(verdict => <button type="button" key={verdict}
        aria-pressed={current?.observations[window.id] === verdict} onClick={() => {
          const persisted = saveRoofObservation(scope, window.id, current?.observations[window.id] === verdict ? null : verdict)
          setNotice({ snapshot: scope.snapshot, message: persisted ? 'Saved locally. Click the selected label again to clear it.' : 'Kept for this session; browser storage is unavailable.' })
        }}>{verdict}</button>)}</div>
    </div>)}
    {previous && <p>Earlier observations used a different interpretation or input configuration. This result starts unaudited.</p>}
    <small role="status">{(notice?.snapshot === scope.snapshot ? notice.message : '') || (current ? 'Recorded for this broker, pair and interpretation snapshot.' : 'Optional manual observations; these never adjust the scoring rules.')}</small>
  </section>
}
