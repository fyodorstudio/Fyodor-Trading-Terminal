import type { PriceAlertsController } from './usePriceAlerts'
import './price-alerts.css'

export function PriceAlertDeliveryNotice({ controller }: { controller: PriceAlertsController }) {
  if (!controller.pendingSounds && !controller.missedSounds) return null
  return <div className="price-alert-delivery-notice" role="alert">
    <strong>Price alert triggered</strong>
    <span>{controller.pendingSounds ? `${controller.pendingSounds} sound(s) waiting for playback. Retrying for up to 5 minutes.`
      : `${controller.missedSounds} sound(s) could not play. Check the triggered alerts.`}</span>
    {controller.pendingSounds > 0 && <button type="button" onClick={() => void controller.enableSound()}>Enable / retry sound</button>}
    <button type="button" onClick={controller.dismissSoundWarnings}>Silence / acknowledge</button>
  </div>
}
