import { useEffect, useRef, useState } from 'react'
import { useNewsSettings } from './settings'
import { allowNewsPopups, popupPermission, stopNewsPopups, testNewsPopup, useNewsPopupError } from './browser-notifications'

export function NewsPopupSettings() {
  const [settings, change] = useNewsSettings(), deliveryError = useNewsPopupError()
  const [permission, setPermission] = useState(popupPermission), [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(''), [error, setError] = useState('')
  const mounted = useRef(true), attempt = useRef(0)
  useEffect(() => {
    const refresh = () => setPermission(popupPermission())
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function enable() {
    const token = ++attempt.current
    setBusy(true); setError(''); setMessage('')
    try {
      await allowNewsPopups()
      if (mounted.current && token === attempt.current) change(old => ({ ...old, browserNotifications: true }))
    } catch (cause) { if (mounted.current && token === attempt.current) setError(cause instanceof Error ? cause.message : 'Could not enable Windows popups.') }
    finally { if (mounted.current && token === attempt.current) { setPermission(popupPermission()); setBusy(false) } }
  }
  return <div className="news-popup-settings">
    <label className="news-checkbox"><input type="checkbox" aria-label="Windows headline popups" checked={settings.browserNotifications} disabled={busy || permission === 'unsupported' || permission === 'insecure'} onChange={event => {
      if (event.target.checked) void enable()
      else { change(old => ({ ...old, browserNotifications: false })); stopNewsPopups(); setError(''); setMessage('') }
    }} />Windows headline popups</label>
    <button type="button" aria-label="Test Windows headline popup" disabled={busy || !settings.browserNotifications || permission !== 'granted'} onClick={() => {
      try { testNewsPopup(); setMessage('Test requested. Check Windows for the banner; display is controlled by your browser and Windows.'); setError('') }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Popup test failed.') }
    }}>Test popup</button>
    <p>Uses the shared trigger, providers, keywords and publication-age limit. Silent banners avoid a second sound. Keep this terminal tab open; it can be minimized. This switch applies only to this browser.</p>
    {permission === 'unsupported' && <p>This browser does not support desktop popups.</p>}
    {permission === 'insecure' && <p>Use http://localhost or HTTPS to enable browser notifications.</p>}
    {permission === 'denied' && <p>Notifications are blocked. Allow them in this site’s browser settings.</p>}
    {(error || settings.browserNotifications && deliveryError) && <p role="alert">{error || deliveryError}</p>}
    {message && <p role="status">{message}</p>}
  </div>
}
