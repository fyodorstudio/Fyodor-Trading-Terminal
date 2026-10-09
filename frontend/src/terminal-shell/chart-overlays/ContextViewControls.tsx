import { saveSequencePreferences, useSequencePreferences } from '../../usd-context/sequences/storage/sequence-preferences'
import { openFundamentalSettings } from '../../fundamental-tools/runtime/settings-navigation'
import { CandyIcon, RaycasterIcon, RoofsIcon, ToolsGearIcon } from '../../fundamental-tools/ui/ToolIcons'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import '../../fundamental-tools/ui/fundamental-tools.css'

export function ContextViewControls({ symbol, supported, raycasterVisible = false, onToggleRaycaster,
  settingsActive = false }: {
  symbol: string; supported: boolean; raycasterVisible?: boolean; onToggleRaycaster?: () => void;
  brokerId?: string | null; timeframe?: ChartTimeframe; clockOffsetMs?: number; brokerOffsetSeconds?: number; timeDisplay?: TimeDisplayPreference; settingsActive?: boolean
}) {
  const preferences = useSequencePreferences()
  const relativeSupported = /^EURUSD(?:[._-].*|[a-z]*)$/i.test(symbol)
  return <div className="fundamental-tools" role="group" aria-label="Fundamental tools">
    {onToggleRaycaster && <button type="button" className={`chart-drawing-toggle${raycasterVisible && supported ? ' active' : ''}`} disabled={!supported}
      aria-pressed={raycasterVisible && supported} aria-label={raycasterVisible && supported ? 'Hide Raycaster' : 'Show Raycaster'}
      title="Raycaster · Context at the hovered candle" onClick={onToggleRaycaster}><RaycasterIcon /></button>}
    <button type="button" className={`chart-drawing-toggle${relativeSupported && preferences.roofs ? ' active' : ''}`} disabled={!relativeSupported}
      aria-pressed={relativeSupported && preferences.roofs} aria-label={preferences.roofs ? 'Hide roofs' : 'Show roofs'} title="Roofs · Connected release combinations"
      onClick={() => saveSequencePreferences({ ...preferences, roofs: !preferences.roofs })}><RoofsIcon /></button>
    <button type="button" className={`chart-drawing-toggle${supported && preferences.ribbon ? ' active' : ''}`} disabled={!supported}
      aria-pressed={supported && !!preferences.ribbon} aria-label={preferences.ribbon ? 'Hide Candy' : 'Show Candy'} title="Candy · Show configured timelines"
      onClick={() => saveSequencePreferences({ ...preferences, ribbon: !preferences.ribbon })}><CandyIcon /></button>
    <button type="button" className={`chart-drawing-toggle fundamental-tools-gear${settingsActive ? ' active' : ''}`}
      aria-label="Fundamental tools settings" title="Fundamental Settings" aria-expanded={settingsActive} aria-controls="fundamental-settings"
      onClick={() => openFundamentalSettings()}><ToolsGearIcon /></button>
  </div>
}
