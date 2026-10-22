import { memo } from 'react'
import { AlertDock } from '../alert'
import { useAlarms } from './useAlarms'
import './events-alarms.css'

export const EventsDock = memo(function EventsDock({ brokerId, focusKey }: {
  brokerId: string | null; brokerOffsetSeconds?: number; focusKey: string | null
}) {
  const alarms = useAlarms()
  const sourceId = brokerId?.startsWith('Pepperstone-') ? brokerId : 'Pepperstone-Demo'
  return <section className="events-alarm-dock" aria-label="Alert"><AlertDock sourceId={sourceId} alarms={alarms} focusKey={focusKey} /></section>
})
