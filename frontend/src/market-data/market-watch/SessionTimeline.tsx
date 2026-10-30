import { memo, useEffect, useMemo, useState } from 'react'
import { forexSessions } from './forex-sessions'
import './session-timeline.css'

export const SessionTimeline = memo(function SessionTimeline() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const timeline = useMemo(() => forexSessions(now), [now])
  return <div className="session-timeline" aria-label="Forex sessions in Jakarta time">
    <div className="session-timeline-heading" title="Indicative regional dealing hours, adjusted for daylight saving. Broker holidays and trading availability may differ.">
      Sessions · Jakarta</div>
    <div className="session-timeline-body">
      <div className="session-timeline-labels">{timeline.sessions.map(session => <span key={session.name}>{session.name}</span>)}</div>
      <svg viewBox="0 0 1440 40" preserveAspectRatio="none" role="img" aria-label="24-hour session timeline; vertical line marks now">
        {[0, 360, 720, 1080, 1440].map(x => <line key={x} x1={x} x2={x} y1="0" y2="40" className="session-timeline-grid" />)}
        {timeline.sessions.map((session, index) => session.windows.map(window => <rect key={`${session.name}:${window.open}`}
          x={window.from * 1440} width={(window.to - window.from) * 1440} y={index * 10 + 2} height="6" rx="3"
          fill={session.color} opacity={session.active && now >= window.open && now < window.close ? 1 : 0.55}>
          <title>{session.name}: {window.label} · {now >= window.open && now < window.close ? 'Active' : 'Inactive'}</title>
        </rect>))}
        <line x1={timeline.now * 1440} x2={timeline.now * 1440} y1="0" y2="40" className="session-timeline-now"><title>Now</title></line>
      </svg>
    </div>
    <div className="session-timeline-axis" aria-hidden="true"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div>
  </div>
})
