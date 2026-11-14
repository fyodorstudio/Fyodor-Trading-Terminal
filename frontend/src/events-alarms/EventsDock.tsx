import { memo } from 'react'
import { AlertDock } from '../alert'
import { useAlarms } from './useAlarms'
import './events-alarms.css'
import type { AlertFocus } from '../alert/model/alert-focus'

export const EventsDock = memo(function EventsDock({ brokerId, focus }: {
  brokerId: string | null; focus?: AlertFocus | null
}) {
  const alarms = useAlarms()
  const sourceId = brokerId?.startsWith('Pepperstone-') ? brokerId : 'Pepperstone-Demo'
  return <section className="events-alarm-dock" aria-label="Alert"><AlertDock sourceId={sourceId} alarms={alarms} focus={focus} /></section>
})
