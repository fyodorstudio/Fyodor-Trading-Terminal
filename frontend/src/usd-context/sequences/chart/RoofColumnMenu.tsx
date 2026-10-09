import type { ComboSnapshot } from '../../../scoring-system/relationships/contracts'
import { activationLabel } from '../../../scoring-system/relationships/combo-activation'
import { roofResultLabel, roofSupport } from '../../../scoring-system/relationships/relationship-support'
import { SupportSplit } from '../../ui/SupportSplit'
import { roofLabel, roofTooltip } from './roof-label'
import type { RoofOverflowColumn } from './roof-plan'
import type { comboColumnSummary } from './combo-column-summary'

/** Local chooser presentation; viewport subscriptions and selection belong to ComboRoofs. */
export function RoofColumnMenu({ group, summary, concise, open, selectedId, top, buttonWidth, menuWidth, chartWidth, candleAt, clock, onToggle, onSelect, onOpenGroup, groupActive }: {
  group: RoofOverflowColumn; summary?: ReturnType<typeof comboColumnSummary>; concise: boolean; open: boolean;
  selectedId?: string; top: number; buttonWidth: number; menuWidth: number; chartWidth: number;
  candleAt: number; clock: (at: number) => string; onToggle: () => void; onSelect: (combo: ComboSnapshot) => void
  onOpenGroup?: () => void; groupActive?: boolean
}) {
  const updates = summary?.updates.map(update => `${clock(update.at)} · ${update.kind === 'publication' ?
    `${update.releases.join(' + ')} · New release` : `${activationLabel(update.kind)} · No new release`}`) ?? []
  return <div className="combo-roof-overflow" data-roof-column={group.column} style={{ left: group.x, top }}>
    <button type="button" style={{ width: buttonWidth }} aria-expanded={concise && onOpenGroup ? undefined : open}
      aria-pressed={concise ? groupActive ?? group.combos.some(combo => combo.id === selectedId) : undefined}
      title={summary ? updates.join('\n') : undefined}
      aria-label={`${concise ? 'Combos' : 'More combos'} on candle ${clock(candleAt)} · ${group.combos.length} ${concise ? 'combinations' : 'hidden'}`}
      onClick={concise && onOpenGroup ? onOpenGroup : onToggle}>+{group.combos.length} {concise ? 'Combo' : 'more'}</button>
    {open && <div aria-label="More combo roofs" style={{ width: menuWidth,
      left: Math.max(8, Math.min(group.x - menuWidth / 2, chartWidth - menuWidth - 8)) - group.x + buttonWidth / 2 }}>
      {summary && <header className="combo-column-summary">
        <strong>{group.combos.length} combinations</strong>
        <span>Long leads: {summary.counts.long} · Short leads: {summary.counts.short}
          {summary.counts.balanced > 0 && <> · Balanced: {summary.counts.balanced}</>}
          {summary.counts.unchanged > 0 && <> · Unchanged: {summary.counts.unchanged}</>}
          {summary.counts.insufficient > 0 && <> · Insufficient: {summary.counts.insufficient}</>}</span>
        {updates.map((text, index) => <small key={summary.updates[index].at}>{text}</small>)}
      </header>}
      {group.combos.map(combo => <button type="button" key={combo.id} data-roof-id={combo.id}
        title={roofTooltip(combo, 0, clock)} onClick={() => onSelect(combo)}>
        <span>{roofLabel(combo)} · {roofResultLabel(combo)}</span>
        <SupportSplit support={roofSupport(combo)} compact />
        <small>{combo.strength ? `${combo.strength} evidence` : 'Direction withheld'} · {clock(combo.chartAt)}</small>
      </button>)}
    </div>}
  </div>
}
