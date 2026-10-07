import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { saveSequencePreferences, useSequencePreferences } from '../../usd-context/sequences/storage/sequence-preferences'
import { FundamentalToolsPopover } from '../../fundamental-tools/ui/FundamentalToolsPopover'
import { CandyIcon, RaycasterIcon, RoofsIcon, ToolsGearIcon } from '../../fundamental-tools/ui/ToolIcons'
import type { ChartTimeframe } from '../../market-data/contracts/ChartTimeframe'
import type { TimeDisplayPreference } from '../../appearance/time-display/time-display-preference'
import { toolScope } from '../../fundamental-tools/runtime/inspection-session'
import '../../fundamental-tools/ui/fundamental-tools.css'

export function ContextViewControls({ symbol, supported, raycasterVisible = false, onToggleRaycaster,
  brokerId = null, timeframe = 'H1', clockOffsetMs = 0, brokerOffsetSeconds = 0, timeDisplay = { mode: 'utc', utcOffsetMinutes: 0 } }: {
  symbol: string; supported: boolean; raycasterVisible?: boolean; onToggleRaycaster?: () => void;
  brokerId?: string | null; timeframe?: ChartTimeframe; clockOffsetMs?: number; brokerOffsetSeconds?: number; timeDisplay?: TimeDisplayPreference
}) {
  const preferences = useSequencePreferences(), [openIdentity, setOpenIdentity] = useState<object | null>(null)
  const trigger = useRef<HTMLButtonElement>(null), id = useId(), scope = toolScope(brokerId, symbol, timeframe)
  const identity = useMemo(() => ({ scope }), [scope])
  const open = openIdentity === identity, close = useCallback(() => setOpenIdentity(null), [])
  const relativeSupported = /^EURUSD(?:[._-].*|[a-z]*)$/i.test(symbol)
  return <div className="fundamental-tools" role="group" aria-label="Fundamental tools">
    {onToggleRaycaster && <button type="button" className={`chart-drawing-toggle${raycasterVisible && supported ? ' active' : ''}`} disabled={!supported}
      aria-pressed={raycasterVisible && supported} aria-label={raycasterVisible && supported ? 'Hide Raycaster' : 'Show Raycaster'}
      title="Raycaster · Context at the hovered candle" onClick={onToggleRaycaster}><RaycasterIcon /></button>}
    <button type="button" className={`chart-drawing-toggle${relativeSupported && preferences.roofs ? ' active' : ''}`} disabled={!relativeSupported}
      aria-pressed={relativeSupported && preferences.roofs} aria-label={preferences.roofs ? 'Hide roofs' : 'Show roofs'} title="Roofs · Connected release combinations"
      onClick={() => saveSequencePreferences({ ...preferences, roofs: !preferences.roofs })}><RoofsIcon /></button>
    <button type="button" className={`chart-drawing-toggle${supported && preferences.ribbon ? ' active' : ''}`} disabled={!supported}
      aria-pressed={supported && !!preferences.ribbon} aria-label={preferences.ribbon ? 'Hide context ribbon' : 'Show context ribbon'} title="Candy · Context timeline"
      onClick={() => saveSequencePreferences({ ...preferences, ribbon: !preferences.ribbon })}><CandyIcon /></button>
    <button ref={trigger} type="button" className={`chart-drawing-toggle fundamental-tools-gear${open ? ' active' : ''}`}
      aria-label="Fundamental tools settings" title="Fundamental tools settings" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpenIdentity(open ? null : identity)}><ToolsGearIcon /></button>
    {open && <FundamentalToolsPopover key={scope} id={id} scope={scope} trigger={trigger} onClose={close} symbol={symbol}
      supported={supported} relativeSupported={relativeSupported} brokerId={brokerId} timeDisplay={timeDisplay}
      clockOffsetMs={clockOffsetMs} brokerOffsetSeconds={brokerOffsetSeconds} />}
  </div>
}
