import { useCallback, useId, useState } from 'react'
import { selectedMagnitudeBin, type MagnitudeDistribution } from './magnitude-distribution'
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
  const dismiss = useCallback(() => setDismissed(true), [])
  const open = (hovered || focused) && !dismissed
  const left = 3, width = 173, base = 21, tailX = 190, tailWidth = 20
  const x = (value: number) => left + Math.min(1, value / d.scaleMax) * width
  const peak = Math.max(1, ...d.bins, d.overflow)
  const selected = selectedMagnitudeBin(d)
  const interval = !selected ? 'No current magnitude' : selected.to === null ? `Beyond ${formatValue(selected.from)}` :
    `${formatValue(selected.from)}–${formatValue(selected.to)}`
  const details = `${label}. Absolute A−P: ${d.magnitude === null ? 'unavailable' : formatValue(d.magnitude)}. ` +
    (d.percentile === null ? '' : `${d.percentile.toFixed(1)}% of earlier magnitudes are at or below this reading. `) +
    `${d.count} earlier readings${d.count < 12 ? ' (small sample)' : ''}. ` +
    `P50 ${formatValue(d.p50)}; P75 ${formatValue(d.p75)}; P90 ${formatValue(d.p90)}. ` +
    `Axis 0–${formatValue(d.scaleMax)}. Tail contains ${d.overflow} earlier readings. ` +
    (selected ? `Selected interval: ${interval}; ${selected.count} earlier readings in this bin. ` : '') +
    historyDetails.map((item) => `${item.label}: ${item.value}. `).join('') + context
  function bar(index: number | 'tail', count: number, at: number, barWidth: number) {
    const current = selected?.index === index
    const height = count / peak * 19
    return <g key={index}>
      {current && count === 0 && <rect className="magnitude-bin-highlight" x={at - .5} y="1" width={barWidth + 1} height={base}
        rx="2" aria-hidden="true" />}
      <rect className={`magnitude-bar${current ? ' magnitude-current' : ''}${current && count === 0 ? ' magnitude-empty-bin' : ''}`}
        data-bin={index} data-count={count} data-overflow={index === 'tail'} x={at} y={count ? base - height : base - 1}
        width={barWidth} height={count ? height : current ? 1 : 0} rx="1" />
    </g>
  }
  return <span ref={setAnchor} className={`magnitude-histogram inspector-grade-${tone}`} tabIndex={0} aria-label={details}
    aria-describedby={open ? tooltipId : undefined}
    onMouseEnter={() => { setHovered(true); setDismissed(false) }} onMouseLeave={() => setHovered(false)}
    onFocus={() => { setFocused(true); setDismissed(false) }} onBlur={() => setFocused(false)}>
    <svg viewBox="0 0 216 32" width="216" height="32" aria-hidden="true">
      {d.bins.map((count, index) => bar(index, count, left + index * width / d.bins.length, width / d.bins.length - 2))}
      <line className="magnitude-axis" x1={left} x2={left + width} y1={base + 1} y2={base + 1} />
      {([['50', d.p50], ['75', d.p75], ['90', d.p90]] as const).map(([name, value]) =>
        <line className="magnitude-quantile" key={name} x1={x(value)} x2={x(value)} y1={base + 1} y2={base + 4} />)}
      <line className="magnitude-tail-divider" x1="183" x2="183" y1="3" y2={base + 1} />
      {bar('tail', d.overflow, tailX, tailWidth)}
      <text className="magnitude-label" x={left} y="32">0</text>
      <text className="magnitude-label" x={left + width} y="32" textAnchor="end">{formatValue(d.scaleMax)}</text>
      <text className="magnitude-label" x={tailX + tailWidth / 2} y="32" textAnchor="middle">Tail</text>
    </svg>
    <span className="magnitude-rank"><strong>{d.percentile === null ? '—' : `P${Math.round(d.percentile)}`}</strong>
      <small>{d.count} earlier</small></span>
    {open && anchor && <MagnitudeDetails anchor={anchor} id={tooltipId} onDismiss={dismiss}>
      <strong className="magnitude-details-heading">{label}</strong>
      <dl>
        <div><dt>Absolute A−P</dt><dd>{d.magnitude === null ? 'Unavailable' : formatValue(d.magnitude)}</dd></div>
        <div><dt>Magnitude rank</dt><dd>{d.percentile === null ? 'Unavailable' : `${d.percentile.toFixed(1)}% at or below`}</dd></div>
        <div><dt>Earlier readings</dt><dd>{d.count}{d.count < 12 ? ' · Small sample' : ''}</dd></div>
        {historyDetails.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        <div><dt>Selected interval</dt><dd>{interval}{selected && ` · ${selected.count} readings`}</dd></div>
      </dl>
      <div className="magnitude-details-quantiles">{([['P50', d.p50], ['P75', d.p75], ['P90', d.p90]] as const).map(([name, value]) =>
        <span key={name}>{name}<b>{formatValue(value)}</b></span>)}</div>
      <p>Axis: 0–{formatValue(d.scaleMax)} · Tail: {d.overflow} earlier readings.</p>
      {selected?.count === 0 && <p>No earlier readings in the selected interval; its outline shows the location.</p>}
      {d.allZero && <p>Earlier magnitudes are all zero.</p>}
      <p className="magnitude-details-note">{context} Bar height counts earlier readings; the colored bin shows the current magnitude's range.</p>
    </MagnitudeDetails>}
  </span>
}
