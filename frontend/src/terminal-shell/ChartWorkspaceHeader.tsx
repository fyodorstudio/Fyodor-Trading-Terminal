import type { ChartTimeframe } from '../market-data/contracts/ChartTimeframe'
import type { SymbolQuote } from '../market-data/contracts/SymbolQuote'
import type { MarketWatchDock } from '../workspace-docking/left-dock/useMarketWatchDock'
import { SessionTimeline } from '../market-data/market-watch/SessionTimeline'
import { isNdfSymbol } from '../market-data/market-watch/symbol-classification'
import { supportsMacro } from '../market-data/indicators/macro/macro-data'
import { swingStrengthLimits, type MarketStructurePreferences } from '../market-data/indicators/market-structure/market-structure-preferences'
import { nextEventIconMode, type EventIconMode } from '../appearance/event-icons-visibility'
import '../market-data/indicators/rsi/rsi.css'

const eventIconLabels: Record<EventIconMode, string> = {
  off: 'Off', wildcards: 'Wildcards only', inspector: 'Inspector only', all: 'All',
}

const timeframes: ChartTimeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1']

type ChartWorkspaceHeaderProps = {
  marketWatch?: MarketWatchDock
  symbol: string
  quote: SymbolQuote | null
  timeframe: ChartTimeframe
  onSelectTimeframe: (timeframe: ChartTimeframe) => void
  onRefocus?: () => void
  refocusDisabled?: boolean
  drawingToolbarVisible?: boolean
  onToggleDrawingToolbar?: () => void
  volumeProfileEnabled?: boolean
  onToggleVolumeProfile?: () => void
  onOpenVolumeProfileSettings?: () => void
  marketStructure?: MarketStructurePreferences
  onChangeMarketStructure?: (changes: Partial<MarketStructurePreferences>) => void
  onToggleMarketStructure?: () => void
  onOpenMarketStructureSettings?: () => void
  atrEnabled?: boolean
  onToggleAtr?: () => void
  onOpenAtrSettings?: () => void
  volumeEnabled?: boolean
  onToggleVolume?: () => void
  onOpenVolumeSettings?: () => void
  rsiEnabled?: boolean
  onToggleRsi?: () => void
  onOpenRsiSettings?: () => void
  macroEnabled?: boolean
  onToggleMacro?: () => void
  onOpenMacroSettings?: () => void
  eventIconMode?: EventIconMode
  onCycleEventIcons?: () => void
  recentEventsOpen?: boolean
  onToggleRecentEvents?: () => void
  rankingOpen?: boolean
  onToggleRanking?: () => void
  newsOpen?: boolean
  onToggleNews?: () => void
  detailOpen?: boolean
  onToggleDetail?: () => void
}

function PaintbrushIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
      <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
    </svg>
  )
}

function IndicatorSettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 3-.5 2.2-2 .9L4.6 5 2 9.5l1.8 1.4v2.2L2 14.5 4.6 19l1.9-1.1 2 .9L9 21h6l.5-2.2 2-.9 1.9 1.1 2.6-4.5-1.8-1.4v-2.2L22 9.5 19.4 5l-1.9 1.1-2-.9L15 3z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function ChartWorkspaceHeader({
  marketWatch,
  symbol,
  quote,
  timeframe,
  onSelectTimeframe,
  onRefocus,
  refocusDisabled = false,
  drawingToolbarVisible = true,
  onToggleDrawingToolbar,
  volumeProfileEnabled = false,
  onToggleVolumeProfile,
  onOpenVolumeProfileSettings,
  marketStructure,
  onChangeMarketStructure,
  onToggleMarketStructure,
  onOpenMarketStructureSettings,
  atrEnabled = false,
  onToggleAtr,
  onOpenAtrSettings,
  volumeEnabled = false,
  onToggleVolume,
  onOpenVolumeSettings,
  rsiEnabled = false,
  onToggleRsi,
  onOpenRsiSettings,
  macroEnabled = false,
  onToggleMacro,
  onOpenMacroSettings,
  eventIconMode = 'wildcards',
  onCycleEventIcons,
  recentEventsOpen = false,
  onToggleRecentEvents,
  rankingOpen = false,
  onToggleRanking,
  newsOpen = false,
  onToggleNews,
  detailOpen = false,
  onToggleDetail,
}: ChartWorkspaceHeaderProps) {
  const marketStructureEnabled = marketStructure?.enabled ?? false
  const majorTrendlines = !!(marketStructure?.showAutoTrendlines && marketStructure.showMajorTrendlines)
  const minorTrendlines = !!(marketStructure?.showAutoTrendlines && marketStructure.showMinorTrendlines)
  const changeTrendlines = (showMajorTrendlines: boolean, showMinorTrendlines: boolean) =>
    onChangeMarketStructure?.({
      showMajorTrendlines, showMinorTrendlines, showAutoTrendlines: showMajorTrendlines || showMinorTrendlines,
    })
  return (
    <div className="chart-toolbar">
      <div className="active-market">
        <div className="market-icon">{symbol.slice(0, 2)}</div>
        <div className="market-heading">
          <div className="market-title-row">
            <h1>{symbol}</h1>
            {isNdfSymbol(symbol) && <span className="market-instrument-badge" title="Non-deliverable forward">NDF</span>}
            {quote?.dailyChange != null && (
              <span className={quote.dailyChange >= 0 ? 'positive' : 'negative'}>
                {quote.dailyChange >= 0 ? '+' : ''}{quote.dailyChange.toFixed(2)}%
              </span>
            )}
          </div>
          <p className="market-subtitle" title={quote?.synthetic
            ? 'Equal-weight index against seven currencies. Based at 100 on 6 Jan 2025.' : undefined}>
            {quote?.description ?? 'Waiting for MT5 broker data'}
          </p>
        </div>
        {marketWatch && (
          <button
            type="button"
            className="market-watch-toggle"
            onClick={marketWatch.toggle}
            aria-expanded={!marketWatch.collapsed}
            aria-controls={marketWatch.contentId}
            aria-label={marketWatch.collapsed ? 'Show Market Watch' : 'Collapse Market Watch'}
            title={marketWatch.collapsed ? 'Show Market Watch' : 'Collapse Market Watch'}
          />
        )}
      </div>

      <div className="chart-toolbar-center">
        <div className="timeframe-selector" aria-label="Chart timeframe">
          {timeframes.map((item) => (
            <button
              key={item}
              type="button"
              className={item === timeframe ? 'active' : ''}
              aria-pressed={item === timeframe}
              onClick={() => onSelectTimeframe(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {onRefocus && <button type="button" className="chart-refocus-button" aria-label="Refocus chart" title="Refocus on latest candles"
          disabled={refocusDisabled} onClick={onRefocus}>
          <span aria-hidden="true">⛶</span>
        </button>}
        <div className="chart-header-actions">
        {onToggleVolumeProfile && <div className="rsi-header-controls" role="group" aria-label="Volume Profile indicator">
          <button type="button" aria-pressed={volumeProfileEnabled} onClick={onToggleVolumeProfile}
            aria-label={volumeProfileEnabled ? 'Hide Volume Profile' : 'Show Volume Profile'} title="Volume Profile">VP</button>
          {onOpenVolumeProfileSettings && <button type="button" onClick={onOpenVolumeProfileSettings}
            aria-label="Volume Profile settings" title="Volume Profile settings" aria-haspopup="dialog"><IndicatorSettingsIcon /></button>}
        </div>}
        {onToggleMarketStructure && <div className="rsi-header-controls" role="group" aria-label="Market Structure indicator">
          {marketStructure?.enabled && onChangeMarketStructure && <>
            <label className="market-structure-toolbar-slider">
              <span>Swing strength</span>
              <input type="range" min={swingStrengthLimits.min} max={swingStrengthLimits.max} step={1}
                value={marketStructure.swingStrength}
                onChange={event => onChangeMarketStructure({ swingStrength: event.currentTarget.valueAsNumber })} />
              <span aria-hidden="true">{marketStructure.swingStrength}</span>
            </label>
            <button type="button" className="market-structure-toolbar-toggle" aria-pressed={marketStructure.extendLines}
              aria-label="Extend Market Structure lines" title="Extend horizontal Market Structure lines to the latest candle"
              onClick={() => onChangeMarketStructure({ extendLines: !marketStructure.extendLines })}>E</button>
            <button type="button" className="market-structure-toolbar-toggle" aria-pressed={majorTrendlines}
              aria-label="Major trendlines" title="Major trendlines · Three or more well-spaced touches"
              onClick={() => changeTrendlines(!majorTrendlines, minorTrendlines)}>M</button>
            <button type="button" className="market-structure-toolbar-toggle" aria-pressed={minorTrendlines}
              aria-label="Minor trendlines" title="Minor trendlines · Fewer than three well-spaced touches"
              onClick={() => changeTrendlines(majorTrendlines, !minorTrendlines)}>m</button>
          </>}
          <button type="button" aria-pressed={marketStructureEnabled} onClick={onToggleMarketStructure}
            aria-label={marketStructureEnabled ? 'Hide Market Structure' : 'Show Market Structure'}
            title={marketStructureEnabled ? 'Hide Market Structure' : 'Show Market Structure'}>MS</button>
          <button type="button" onClick={onOpenMarketStructureSettings} aria-label="Market Structure settings" title="Market Structure settings" aria-haspopup="dialog">
            <IndicatorSettingsIcon />
          </button>
        </div>}
        {onToggleAtr && <div className="rsi-header-controls" role="group" aria-label="ATR indicator">
          <button type="button" aria-pressed={atrEnabled} onClick={onToggleAtr}
            aria-label={atrEnabled ? 'Hide ATR' : 'Show ATR'} title={atrEnabled ? 'Hide ATR' : 'Show ATR'}>ATR</button>
          <button type="button" onClick={onOpenAtrSettings} aria-label="ATR settings" title="ATR settings" aria-haspopup="dialog">
            <IndicatorSettingsIcon />
          </button>
        </div>}
        {onToggleVolume && <div className="rsi-header-controls" role="group" aria-label="Volume indicator">
          <button type="button" aria-pressed={volumeEnabled} onClick={onToggleVolume}
            aria-label={volumeEnabled ? 'Hide Volume' : 'Show Volume'} title={volumeEnabled ? 'Hide Volume' : 'Show Volume'}>Volume</button>
          {onOpenVolumeSettings && <button type="button" onClick={onOpenVolumeSettings} aria-label="Volume settings" title="Volume settings" aria-haspopup="dialog">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 3-.5 2.2-2 .9L4.6 5 2 9.5l1.8 1.4v2.2L2 14.5 4.6 19l1.9-1.1 2 .9L9 21h6l.5-2.2 2-.9 1.9 1.1 2.6-4.5-1.8-1.4v-2.2L22 9.5 19.4 5l-1.9 1.1-2-.9L15 3z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>}
        </div>}
        {onToggleRsi && <div className="rsi-header-controls" role="group" aria-label="Indicators">
          <button type="button" aria-pressed={rsiEnabled} onClick={onToggleRsi}
            aria-label={rsiEnabled ? 'Hide RSI' : 'Show RSI'} title={rsiEnabled ? 'Hide RSI' : 'Show RSI'}>RSI</button>
          <button type="button" onClick={onOpenRsiSettings} aria-label="RSI settings" title="RSI settings" aria-haspopup="dialog">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 3-.5 2.2-2 .9L4.6 5 2 9.5l1.8 1.4v2.2L2 14.5 4.6 19l1.9-1.1 2 .9L9 21h6l.5-2.2 2-.9 1.9 1.1 2.6-4.5-1.8-1.4v-2.2L22 9.5 19.4 5l-1.9 1.1-2-.9L15 3z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>}
        {onToggleMacro && supportsMacro(symbol) && <div className="rsi-header-controls" role="group" aria-label="MFDI indicator">
          <button type="button" aria-pressed={macroEnabled} onClick={onToggleMacro}
            aria-label={macroEnabled ? 'Hide MFDI' : 'Show MFDI'}
            title="Macro Factor Data Inspector · USDX">MFDI</button>
          <button type="button" onClick={onOpenMacroSettings} aria-label="MFDI settings" title="MFDI settings" aria-haspopup="dialog">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 3-.5 2.2-2 .9L4.6 5 2 9.5l1.8 1.4v2.2L2 14.5 4.6 19l1.9-1.1 2 .9L9 21h6l.5-2.2 2-.9 1.9 1.1 2.6-4.5-1.8-1.4v-2.2L22 9.5 19.4 5l-1.9 1.1-2-.9L15 3z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>}
        <span className="chart-toolbar-separator" role="separator" aria-orientation="vertical" />
        {onCycleEventIcons && (
          <button type="button" className={`chart-event-toggle${eventIconMode === 'off' ? '' : ' active'}`}
            aria-label={`Event icons: ${eventIconLabels[eventIconMode]}`}
            title={`Event icons: ${eventIconLabels[eventIconMode]} · Next: ${eventIconLabels[nextEventIconMode(eventIconMode)]}`}
            onClick={onCycleEventIcons}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {eventIconMode === 'wildcards' ? <path d="M12 3c0 5-4 9-9 9 5 0 9 4 9 9 0-5 4-9 9-9-5 0-9-4-9-9Z" /> : <>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M7 3v4M17 3v4M3 11h18" />
                {eventIconMode === 'off' && <path d="m3 3 18 18" />}
                {eventIconMode === 'inspector' && <path d="M8 15h2m4 0h2" />}
                {eventIconMode === 'all' && <path d="M12 13v6m-3-3h6" />}
              </>}
            </svg>
          </button>
        )}
        {onToggleDrawingToolbar && (
          <button
            type="button"
            className={`chart-drawing-toggle${drawingToolbarVisible ? ' active' : ''}`}
            aria-pressed={drawingToolbarVisible}
            aria-label={drawingToolbarVisible ? 'Hide drawing toolbar' : 'Show drawing toolbar'}
            title={drawingToolbarVisible ? 'Hide drawing toolbar' : 'Show drawing toolbar'}
            onClick={onToggleDrawingToolbar}
          >
            <PaintbrushIcon />
          </button>
        )}
        {onToggleRecentEvents && <button type="button" className={`chart-recent-events-toggle${recentEventsOpen ? ' active' : ''}`}
          aria-label={recentEventsOpen ? 'Hide events' : 'Show events'}
          title={recentEventsOpen ? 'Hide events' : 'Show events'}
          aria-expanded={recentEventsOpen} aria-controls="recent-events-panel" onClick={onToggleRecentEvents}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 11h18M8 15h8M8 18h5" />
          </svg>
        </button>}
        {onToggleDetail && <button type="button" className={`chart-detail-toggle${detailOpen ? ' active' : ''}`}
          aria-label={detailOpen ? 'Hide Detail' : 'Show Detail'} title={detailOpen ? 'Hide Detail' : 'Show Detail'}
          aria-expanded={detailOpen} aria-controls="currency-detail-panel" onClick={onToggleDetail}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M12 9v12M3 15h18" />
          </svg>
        </button>}
        {onToggleRanking && <button type="button" className={`chart-detail-toggle${rankingOpen ? ' active' : ''}`}
          aria-label={rankingOpen ? 'Hide Heatmap Ranking' : 'Show Heatmap Ranking'} title="Heatmap Ranking"
          aria-expanded={rankingOpen} aria-controls="heatmap-ranking-panel" onClick={onToggleRanking}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 20h16M6 17V9h3v8M11 17V4h3v13M16 17v-5h3v5"/></svg>
        </button>}
        {onToggleNews && <button type="button" className={`chart-detail-toggle${newsOpen ? ' active' : ''}`}
          aria-label={newsOpen ? 'Hide News Flow' : 'Show News Flow'} title="News Flow"
          aria-expanded={newsOpen} aria-controls="news-flow-panel" onClick={onToggleNews}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h4v4H7zM14 8h3M14 12h3M7 16h10"/></svg>
        </button>}
        </div>
      </div>

      <div className="chart-toolbar-right">
        <SessionTimeline />
      </div>
    </div>
  )
}
