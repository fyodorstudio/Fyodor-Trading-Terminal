import { memo, useEffect, useMemo, useState } from 'react'
import { forexSessionDayStart, forexSessions } from './forex-sessions'
import './session-timeline.css'

const cursorFormatter = new Intl.DateTimeFormat(undefined, { timeZone: 'Asia/Jakarta',
  weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export const SessionTimeline = memo(function SessionTimeline({ cursorTime }: { cursorTime?: number | null }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const timeline = useMemo(() => forexSessions(now), [now])
  const cursorDay = cursorTime == null ? null : forexSessionDayStart(cursorTime)
  const cursorSessions = useMemo(() => cursorDay === null ? null : forexSessions(cursorDay).sessions, [cursorDay])
  const cursor = cursorTime == null || cursorDay === null ? null : (cursorTime - cursorDay) / 60_000
  const active = new Set(cursorTime == null ? [] : cursorSessions?.filter(session =>
    session.windows.some(window => cursorTime >= window.open && cursorTime < window.close)).map(session => session.name))
  const cursorLabel = cursorTime == null ? '' : `${cursorFormatter.format(cursorTime)} Jakarta · ${active.size ? [...active].join(', ') : 'Between sessions'}`
  return <div className="session-timeline" aria-label="Forex sessions in Jakarta time">
    <div className="session-timeline-heading" title="Indicative regional dealing hours, adjusted for daylight saving. Broker holidays and trading availability may differ.">
      Sessions · Jakarta</div>
    <div className="session-timeline-body">
      <div className="session-timeline-labels">{timeline.sessions.map(session => <span key={session.name}
        className={active.has(session.name) ? 'session-timeline-cursor-active' : undefined}>{session.name}</span>)}</div>
      <svg viewBox="0 0 1440 40" preserveAspectRatio="none" role="img"
        aria-label={cursorLabel ? `Session timeline. Now and hovered candle. ${cursorLabel}` : 'Session timeline. Solid line marks now.'}>
        {[0, 360, 720, 1080, 1440].map(x => <line key={x} x1={x} x2={x} y1="0" y2="40" className="session-timeline-grid" />)}
        {timeline.sessions.map((session, index) => session.windows.map(window => <rect key={`${session.name}:${window.open}`}
          x={window.from * 1440} width={(window.to - window.from) * 1440} y={index * 10 + 2} height="6" rx="3"
          fill={session.color} opacity={session.active && now >= window.open && now < window.close ? 1 : 0.55}>
          <title>{session.name}: {window.label} · {now >= window.open && now < window.close ? 'Active' : 'Inactive'}</title>
        </rect>))}
        <line x1={timeline.now * 1440} x2={timeline.now * 1440} y1="0" y2="40" className="session-timeline-now"><title>Now</title></line>
        {cursor !== null && <line x1={cursor} x2={cursor} y1="0" y2="40" className="session-timeline-cursor">
          <title>{cursorLabel}</title>
        </line>}
      </svg>
    </div>
    <div className="session-timeline-axis" aria-hidden="true"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div>
  </div>
})
