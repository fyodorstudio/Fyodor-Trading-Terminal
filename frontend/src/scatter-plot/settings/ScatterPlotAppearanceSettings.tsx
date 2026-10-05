import { useEffect, useRef } from 'react'
import { customMagnitudeGuideStyles, defaultScatterAppearance, normalizeScatterAppearance, withMagnitudeBandColor, type ScatterAppearance, type ScatterGuideLevel, type ScatterLineStyle } from './scatter-plot-appearance'
import './scatter-plot-appearance-settings.css'

function NumericSetting({ label, value, min, max, step = .5, onChange }: {
  label: string; value: number; min: number; max: number; step?: number | 'any'; onChange: (value: number) => void
}) {
  return <label>{label}<input type="number" aria-label={label} min={min} max={max} step={step} value={value}
    onChange={(event) => { const next = event.target.valueAsNumber; if (Number.isFinite(next) && next >= min && next <= max) onChange(next) }} /></label>
}
function LineSetting({ label, value, onChange }: { label: string; value: ScatterLineStyle; onChange: (value: ScatterLineStyle) => void }) {
  return <div className="scatter-appearance-line">
    <label><input type="checkbox" checked={value.visible} onChange={(e) => onChange({ ...value, visible: e.target.checked })} />{label}</label>
    <input type="color" aria-label={`${label} color`} value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} />
    <NumericSetting label={`${label} width (px)`} value={value.width} min={.25} max={6} step={.05} onChange={(width) => onChange({ ...value, width })} />
  </div>
}
export function ScatterPlotAppearanceSettings({ appearance: a, onChange, onClose, customLimits }: {
  appearance: ScatterAppearance; onChange: (value: ScatterAppearance) => void; onClose: () => void
  customLimits?: readonly number[]
}) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    close.current?.focus()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose])
  const update = (value: ScatterAppearance) => onChange(normalizeScatterAppearance(value))
  const levels = customMagnitudeGuideStyles(a)
  const updateLevel = (id: number, patch: Partial<ScatterGuideLevel>) => {
    const index = levels.findIndex((level) => level.id === id)
    if (patch.color && index >= 0) update(withMagnitudeBandColor(a, index, patch.color, !!customLimits))
    else update({ ...a, customLevels: levels.map((level) => level.id === id ? { ...level, ...patch } : level) })
  }
  return <section className="scatter-appearance-settings" role="dialog" aria-modal="false" aria-label="Scatter Plot appearance">
    <header><strong>Scatter Plot appearance</strong><button ref={close} type="button" onClick={onClose} aria-label="Close Scatter Plot appearance">×</button></header>
    <div className="scatter-appearance-content">
      <fieldset><legend>Dots</legend><div className="scatter-appearance-fields">
        <NumericSetting label="Dot diameter (px)" value={a.dotSize} min={2} max={32} onChange={(dotSize) => update({ ...a, dotSize })} />
        <NumericSetting label="Selected dot diameter (px)" value={a.selectedDotSize} min={2} max={40} onChange={(selectedDotSize) => update({ ...a, selectedDotSize })} />
        {([['Dot color', 'dotColor'], ['Selected Good color', 'goodColor'], ['Selected Bad color', 'badColor']] as const).map(([label, key]) =>
          <label key={key}>{label}<input type="color" value={a[key]} onChange={(e) => update({ ...a, [key]: e.target.value })} /></label>)}
      </div></fieldset>
      <fieldset><legend>Background lines</legend>
        <LineSetting label="Grid" value={a.grid} onChange={(grid) => update({ ...a, grid })} />
        <LineSetting label="Zero line" value={a.zero} onChange={(zero) => update({ ...a, zero })} />
        <LineSetting label="Inspected date" value={a.inspectedDate} onChange={(inspectedDate) => update({ ...a, inspectedDate })} />
      </fieldset>
      <fieldset><legend>Shared magnitude colors</legend><div className="scatter-appearance-fields">
        {(['Small', 'Medium', 'Large'] as const).map((label, index) => <label key={label}>{label}
          <input type="color" aria-label={`${label} magnitude color`} value={a.magnitudeColors[index]}
            onChange={(event) => update(withMagnitudeBandColor(a, index, event.target.value, !!customLimits))} /></label>)}
      </div></fieldset>
      <fieldset><legend>Magnitude guides</legend>
        <div className="scatter-appearance-fields">
          <label><input type="checkbox" checked={a.showGuides} onChange={(e) => update({ ...a, showGuides: e.target.checked })} />Guide lines</label>
          <label><input type="checkbox" checked={a.showBands} onChange={(e) => update({ ...a, showBands: e.target.checked })} />Band shading</label>
          <label>Guide line style<select value={a.guideStyle} onChange={(e) => update({ ...a, guideStyle: e.target.value as ScatterAppearance['guideStyle'] })}>
            <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option>
          </select></label>
          <NumericSetting label="Guide line opacity (%)" value={a.guideOpacity} min={0} max={100} step={1} onChange={(guideOpacity) => update({ ...a, guideOpacity })} />
        </div>
        <p>{customLimits ? 'Small, Medium and Large mirror the saved boundaries. Edit their values in the Magnitude pane.' :
          'Configure and freeze manual boundaries in the Magnitude pane to show guides.'}</p>
        <div className="scatter-appearance-levels">
          {levels.map((level, index) => <div className="scatter-appearance-level" key={level.id}>
            <label><input type="checkbox" aria-label={`Show level ${index + 1}`} checked={level.visible} onChange={(e) => updateLevel(level.id, { visible: e.target.checked })} />{index + 1}</label>
            <span>{['Small', 'Medium', 'Large'][index]} {customLimits ? `±${customLimits[index]}` : 'Undefined'}</span>
            <input type="color" aria-label={`Level ${index + 1} color`} value={level.color} onChange={(e) => updateLevel(level.id, { color: e.target.value })} />
            <NumericSetting label={`Level ${index + 1} width (px)`} value={level.width} min={.25} max={6} step={.05} onChange={(width) => updateLevel(level.id, { width })} />
            <NumericSetting label={`Level ${index + 1} shade (%)`} value={level.shade} min={0} max={100} step={.5} onChange={(shade) => updateLevel(level.id, { shade })} />

          </div>)}
        </div>

      </fieldset>
    </div>
    <footer><button type="button" onClick={() => update(defaultScatterAppearance)}>Reset appearance</button><button type="button" onClick={onClose}>Done</button></footer>
  </section>
}
