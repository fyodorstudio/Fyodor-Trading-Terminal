import type { TimeDisplayPreference } from '../../../appearance/time-display/time-display-preference'
import type { ComboSnapshot, ComboSource, RoofComboGroup } from '../core/contracts'
import { ComboInspector } from './ComboInspector'
import { RoofReleaseOverview } from './RoofReleaseOverview'

export function RoofsDock({ group, combo, page, symbol, timeDisplay, collapsed, restoreOverviewScroll, rememberOverviewScroll, onViewDetails, onBack,
  onToggleCollapsed, onClose, onOpenRelease, onOpenRaycaster }: {
  group: RoofComboGroup | null; combo: ComboSnapshot | null; page: 'overview' | 'details'; symbol: string;
  timeDisplay: TimeDisplayPreference; collapsed: boolean; restoreOverviewScroll: () => number; rememberOverviewScroll: (position: number) => void;
  onViewDetails: (combo: ComboSnapshot) => void; onBack: () => void; onToggleCollapsed: () => void;
  onClose: () => void; onOpenRelease: (source: ComboSource) => void; onOpenRaycaster: () => void
}) {
  if (group && (page === 'overview' || !combo)) return <RoofReleaseOverview group={group} symbol={symbol}
    collapsed={collapsed} restoreScroll={restoreOverviewScroll} rememberScroll={rememberOverviewScroll} selectedId={combo?.id} onViewDetails={onViewDetails}
    onToggleCollapsed={onToggleCollapsed} onClose={onClose} />
  if (combo) return <ComboInspector combo={combo} symbol={symbol} timeDisplay={timeDisplay} collapsed={collapsed}
    onToggleCollapsed={onToggleCollapsed} onClose={onClose} onOpenRelease={onOpenRelease} onOpenRaycaster={onOpenRaycaster}
    onBackToOverview={group ? onBack : undefined} overviewCount={group?.combos.length} />
  return <section className="combo-inspector combo-empty" aria-label="Combo details"><header><strong>Roofs · Combo details</strong></header>
    <p>Select +N Combo on the chart to see all relationships for that release. Select a roof label or a combo from More to inspect individual details.</p></section>
}
