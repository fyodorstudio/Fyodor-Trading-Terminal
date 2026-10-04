import { useCallback, useId, useState } from 'react'
import { magnitudeBandLabel, magnitudeBin, selectedMagnitudeBin, type MagnitudeDistribution } from './magnitude-distribution'
import { MagnitudeDetails } from './MagnitudeDetails'
import './magnitude-histogram.css'

// Family-independent presentation. The adapter owns units, color and provenance.
export function MagnitudeHistogram({ distribution: d, formatValue, label, context, historyDetails = [], tone = 'unchanged' }: {
  distribution: MagnitudeDistribution; formatValue: (value: number) => string; label: string; context: string; tone?: string
  historyDetails?: { label: string; value: string }[]
}) {
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null)
  const tooltipId = useId()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [inspectedBin, setInspectedBin] = useState<number | null>(null)
  const dismiss = useCallback(() => setDismissed(true), [])
  const open = (hovered || focused) && !dismissed
  const left = 5, width = 206, base = 27
  const peak = Math.max(1, ...d.bins)
  const selected = selectedMagnitudeBin(d)
  const inspected = inspectedBin !== null && inspectedBin < d.bins.length ? magnitudeBin(d, inspectedBin) : selected
  const interval = (bin: NonNullable<typeof selected>) => bin.index === 3 ? `${formatValue(0)} (exact)` :
    d.threshold === 0 ? 'Empty (threshold 0)' : bin.index < 3 ? `${formatValue(bin.from)} to < ${formatValue(bin.to)}` :
      `> ${formatValue(bin.from)} to ${formatValue(bin.to)}`
  const frequency = (bin: NonNullable<typeof selected>) => `${bin.count} of ${d.count}` + (d.count ? ` · ${(100 * bin.count / d.count).toFixed(1)}%` : '')
  const historicalValue = (value: number | null) => value === null ? '—' : formatValue(value)
  const extremeLabel = d.currentExtreme === 'negative' ? 'Extreme −' : 'Extreme +'
  const threshold = `|A−P| > ${formatValue(d.threshold).replace(/^\+/, '')}`
  const omitted = d.extremeBelow + d.extremeAbove
  const details = `${label}. Selected A−P: ${d.current === null ? 'unavailable' : formatValue(d.current)}. ` +
    `Selected size: ${d.currentSize}. Historical minimum ${historicalValue(d.min)}; historical maximum ${historicalValue(d.max)}. ` +
    (d.currentExtreme ? `${extremeLabel}. ` : '') +
    `${d.count} earlier readings${d.count < 12 ? ' (small sample)' : ''}. ` +
    (inspected ? `This bar's range: ${magnitudeBandLabel(inspected.index)}, ${interval(inspected)}; ${frequency(inspected)} earlier readings. ` : '') +
    `Extreme threshold: ${threshold}, ${d.source === 'custom' ? 'custom boundaries configured in Scatter Plot' : 'historical 95th percentile of absolute A−P'}. ` +
    `${omitted} historical extremes omitted from the seven bars. Exact zero is the center bar. ` +
    historyDetails.map((item) => `${item.label}: ${item.value}. `).join('') + context
  function bar(index: number, count: number) {
    const at = left + index * width / d.bins.length, slotWidth = width / d.bins.length, barWidth = slotWidth - 2
    const current = selected?.index === index
    const height = count / peak * 19
    return <g key={index} className={inspectedBin === index ? 'magnitude-inspected' : undefined}
      onMouseEnter={() => { setInspectedBin(index); setDismissed(false) }} onMouseLeave={() => setInspectedBin(null)}>
      {current && count === 0 && <rect className="magnitude-bin-highlight" x={at - .5} y="7" width={barWidth + 1} height="21"
        rx="2" aria-hidden="true" />}
      <rect className={`magnitude-bar${current ? ' magnitude-current' : ''}${current && count === 0 ? ' magnitude-empty-bin' : ''}`}
        data-bin={index} data-count={count} x={at} y={count ? base - height : base - 1}
        width={barWidth} height={count ? height : current ? 1 : 0} rx="1" />
      <rect className="magnitude-bin-target" data-bin-target={index} x={at} y="7" width={slotWidth} height="22" />
    </g>
  }
  return <span ref={setAnchor} className={`magnitude-histogram inspector-grade-${tone}`} tabIndex={0} aria-label={details}
    aria-describedby={open ? tooltipId : undefined}
    onMouseEnter={() => { setHovered(true); setDismissed(false) }} onMouseLeave={() => { setHovered(false); setInspectedBin(null) }}
    onFocus={() => { setFocused(true); setDismissed(false); setInspectedBin(null) }} onBlur={() => { setFocused(false); setInspectedBin(null) }}
    onKeyDown={(event) => {
      const index = inspectedBin ?? selected?.index
      let next: number
      if (event.key === 'ArrowRight') next = index === undefined || index === null ? 0 : Math.min(d.bins.length - 1, index + 1)
      else if (event.key === 'ArrowLeft') next = index === undefined || index === null ? d.bins.length - 1 : Math.max(0, index - 1)
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = d.bins.length - 1
      else return
      event.preventDefault(); setInspectedBin(next); setDismissed(false)
    }}>
    <svg viewBox="0 0 216 40" width="216" height="40" aria-hidden="true">
      {d.bins.map((count, index) => bar(index, count))}
      <line className="magnitude-axis" x1={left} x2={left + width} y1={base + 1} y2={base + 1} />
      {d.currentExtreme && <polygon className="magnitude-extreme-marker" data-side={d.currentExtreme}
        points={d.currentExtreme === 'negative' ? '0,17 5,13 5,21' : '216,17 211,13 211,21'} />}
      {d.threshold > 0 && <>
        <text className="magnitude-label" x={left} y="39">{formatValue(-d.threshold)}</text>
        <text className="magnitude-label" x={left + width} y="39" textAnchor="end">{formatValue(d.threshold)}</text>
      </>}
      <text className="magnitude-label magnitude-zero-label" x={left + width / 2} y="39" textAnchor="middle">0</text>
    </svg>
    <strong className="magnitude-size">{d.currentSize}</strong>
    {open && anchor && <MagnitudeDetails anchor={anchor} id={tooltipId} onDismiss={dismiss}>
      <strong className="magnitude-details-heading">{label}</strong>
      <dl>
        <div><dt>Selected A−P</dt><dd>{d.current === null ? 'Unavailable' : formatValue(d.current)}
          {d.current !== null && <strong className="magnitude-details-size">{d.currentSize}</strong>}</dd></div>
        {inspected && <>
          <div><dt>This bar's range</dt><dd>{magnitudeBandLabel(inspected.index)} · {interval(inspected)}</dd></div>
          <div><dt>Earlier readings in range</dt><dd>{frequency(inspected)}</dd></div>
        </>}
        <div><dt>Earlier readings</dt><dd>{d.count}{omitted > 0 ? ` · ${omitted} extremes hidden` : ''}
          {d.count < 12 ? ' · Small sample' : ''}</dd></div>
        <div><dt>Historical minimum</dt><dd>{historicalValue(d.min)}</dd></div>
        <div><dt>Historical maximum</dt><dd>{historicalValue(d.max)}</dd></div>
      </dl>
    </MagnitudeDetails>}
  </span>
}
