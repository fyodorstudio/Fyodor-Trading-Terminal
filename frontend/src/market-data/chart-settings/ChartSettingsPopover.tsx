import { useEffect, type ReactNode } from 'react'
import { ColorThemeButton } from '../../appearance/color-theme/ColorThemeButton'
import type { ColorTheme } from '../../appearance/color-theme/color-theme-preference'
import {
  defaultTimeDisplayPreference,
  formatUtcOffset,
  timeDisplayLabel,
  type TimeDisplayPreference,
  type TimeDisplayMode,
} from '../../appearance/time-display/time-display-preference'
import {
  defaultChartAppearance,
  type ChartAppearance,
  type ScrollbarStyle,
} from './chart-appearance-preference'
import './chart-settings-popover.css'

type ChartSettingsPopoverProps = {
  appearance: ChartAppearance
  timeDisplay: TimeDisplayPreference
  onChange: (appearance: ChartAppearance) => void
  onTimeDisplayChange: (preference: TimeDisplayPreference) => void
  onThemeChanged: (theme: ColorTheme) => void
  onClose: () => void
  children?: ReactNode
}

const offsetOptions = Array.from({ length: 53 }, (_, index) => -720 + index * 30)

export function ChartSettingsPopover({
  appearance,
  timeDisplay,
  onChange,
  onTimeDisplayChange,
  onThemeChanged,
  onClose,
  children,
}: ChartSettingsPopoverProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <section className="chart-settings-popover" role="dialog" aria-modal="false" aria-label="Chart settings">
      <header>
        <div>
          <strong>Chart settings</strong>
          <span>Changes apply immediately and remain on this device.</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close chart settings">×</button>
      </header>

      <div className="chart-settings-content">
        <div className="chart-settings-section">
          <h2>Candles</h2>
          <label className="color-setting">
            <span><strong>Up candle</strong><small>Body, border and wick</small></span>
            <input type="color" value={appearance.upCandleColor} onChange={(event) => onChange({ ...appearance, upCandleColor: event.target.value })} />
          </label>
          <label className="color-setting">
            <span><strong>Down candle</strong><small>Body, border and wick</small></span>
            <input type="color" value={appearance.downCandleColor} onChange={(event) => onChange({ ...appearance, downCandleColor: event.target.value })} />
          </label>
          <label className="color-setting">
            <span><strong>Current price line</strong><small>Latest candle guide</small></span>
            <input type="color" value={appearance.priceLineColor} onChange={(event) => onChange({ ...appearance, priceLineColor: event.target.value })} />
          </label>
        </div>

        <div className="chart-settings-section">
          <h2>Scale and grid</h2>
          <label className="toggle-setting">
            <span><strong>Grid lines</strong><small>Horizontal and vertical guides</small></span>
            <input type="checkbox" checked={appearance.showGrid} onChange={(event) => onChange({ ...appearance, showGrid: event.target.checked })} />
          </label>
          <label className="range-setting">
            <span><strong>Default candle spacing</strong><small>{appearance.barSpacing}px</small></span>
            <input type="range" min="3" max="16" step="1" value={appearance.barSpacing} onChange={(event) => onChange({ ...appearance, barSpacing: Number(event.target.value) })} />
          </label>
          <label className="select-setting">
            <span><strong>Scrollbar style</strong><small>Terminal scrollbars</small></span>
            <select
              value={appearance.scrollbarStyle}
              onChange={(event) => onChange({ ...appearance, scrollbarStyle: event.target.value as ScrollbarStyle })}
            >
              <option value="adaptive">Adaptive (Slate · Blue glow)</option>
              <option value="charcoal">Charcoal / Black</option>
              <option value="blue">Terminal Blue</option>
              <option value="red">Crimson Red</option>
            </select>
          </label>
        </div>

        <div className="chart-settings-section theme-section">
          <h2>Appearance</h2>
          <div className="theme-setting">
            <span>Color theme</span>
            <ColorThemeButton onThemeChanged={onThemeChanged} />
          </div>
        </div>

        <div className="chart-settings-section time-display-section">
          <h2>Universal time presentation</h2>
          <p>One clock applies to the chart, Activity, and Calendar timestamps.</p>
          <div className="time-setting-row">
            <label>
              <span>Display clock</span>
              <select
                value={timeDisplay.mode}
                onChange={(event) => onTimeDisplayChange({ ...timeDisplay, mode: event.target.value as TimeDisplayMode })}
              >
                <option value="local">Local workstation</option>
                <option value="utc">UTC</option>
                <option value="fixed-offset">Fixed UTC offset</option>
              </select>
            </label>
            {timeDisplay.mode === 'fixed-offset' && (
              <label>
                <span>UTC offset</span>
                <select value={timeDisplay.utcOffsetMinutes} onChange={(event) => onTimeDisplayChange({ ...timeDisplay, utcOffsetMinutes: Number(event.target.value) })}>
                  {offsetOptions.map((offset) => <option key={offset} value={offset}>{formatUtcOffset(offset)}</option>)}
                </select>
              </label>
            )}
            <output>{timeDisplayLabel(timeDisplay)}</output>
          </div>
        </div>
        {children}
      </div>

      <footer>
        <button type="button" onClick={() => {
          onChange(defaultChartAppearance)
          onTimeDisplayChange(defaultTimeDisplayPreference)
        }}>Reset chart settings</button>
      </footer>
    </section>
  )
}
