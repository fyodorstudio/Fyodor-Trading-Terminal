import type { TimeDisplayPreference } from '../../../appearance/time-display/time-display-preference'
import type { ComboSnapshot, ComboSource, RoofComboGroup } from '../../../scoring-system/relationships/contracts'
import { ComboInspector } from './ComboInspector'
import { RoofReleaseOverview } from './RoofReleaseOverview'

export function RoofsDock({ group, combo, page, symbol, timeDisplay, restoreOverviewScroll, rememberOverviewScroll, onViewDetails, onBack,
  onOpenRelease, onOpenRaycaster }: {
  group: RoofComboGroup | null; combo: ComboSnapshot | null; page: 'overview' | 'details'; symbol: string;
  timeDisplay: TimeDisplayPreference; restoreOverviewScroll: () => number; rememberOverviewScroll: (position: number) => void;
  onViewDetails: (combo: ComboSnapshot) => void; onBack: () => void;
  onOpenRelease: (source: ComboSource) => void; onOpenRaycaster: () => void
}) {
  if (group && (page === 'overview' || !combo)) return <RoofReleaseOverview group={group} symbol={symbol}
    timeDisplay={timeDisplay} onOpenRelease={onOpenRelease}
    restoreScroll={restoreOverviewScroll} rememberScroll={rememberOverviewScroll} selectedId={combo?.id} onViewDetails={onViewDetails} />
  if (combo) return <ComboInspector combo={combo} symbol={symbol} timeDisplay={timeDisplay}
    onOpenRelease={onOpenRelease} onOpenRaycaster={onOpenRaycaster}
    onBackToOverview={group ? onBack : undefined} overviewCount={group?.combos.length} />
  return <section className="combo-inspector combo-empty" aria-label="Combo details"><header><strong>Roofs · Combo details</strong></header>
    <p>Select +N Combo to view this release’s relationships.</p></section>
}
