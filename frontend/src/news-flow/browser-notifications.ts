import { useSyncExternalStore } from 'react'
import type { NewsItem } from './model'

const journalKey = 'fyodor.news-flow.popups.v1'
const listeners = new Set<() => void>(), open = new Set<Notification>()
let error = ''
const remembered = new Set<string>()
function report(message: string) { error = message; for (const listener of listeners) listener() }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function useNewsPopupError() { return useSyncExternalStore(subscribe, () => error) }

export function popupPermission(): NotificationPermission | 'unsupported' | 'insecure' {
  if (typeof window.Notification !== 'function') return 'unsupported'
  if (!window.isSecureContext) return 'insecure'
  return window.Notification.permission
}
export async function allowNewsPopups() {
  const permission = popupPermission()
  if (permission === 'unsupported') throw Error('This browser does not support desktop popups.')
  if (permission === 'insecure') throw Error('Open the terminal on http://localhost or HTTPS to enable popups.')
  if (permission === 'denied') throw Error('Notifications are blocked. Allow them in this site’s browser settings, then try again.')
  if (permission !== 'granted' && await window.Notification.requestPermission() !== 'granted') {
    throw Error('Notifications were not allowed. You can enable popups again whenever you want.')
  }
}

function identity(value: string) {
  // Compact stable URL identity: bounded browser-local deduplication journal.
  let hash = 14695981039346656037n
  for (const char of value) hash = BigInt.asUintN(64, (hash ^ BigInt(char.codePointAt(0)!)) * 1099511628211n)
  return hash.toString(16)
}
function readJournal() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(journalKey) ?? '[]')
    if (Array.isArray(saved)) for (const key of saved.slice(-2000)) if (typeof key === 'string' && /^[a-f0-9]{1,16}$/.test(key)) remembered.add(key)
  } catch { /* In-memory deduplication still works without browser storage. */ }
}
function remember(key: string) {
  remembered.add(key)
  while (remembered.size > 2000) remembered.delete(remembered.values().next().value!)
  try { window.localStorage.setItem(journalKey, JSON.stringify([...remembered])) } catch { /* Keep the in-memory journal. */ }
}
function banner(title: string, body: string, tag: string, url?: string) {
  const notification = new window.Notification(title, { body, tag, silent: true, requireInteraction: false })
  open.add(notification)
  notification.onclose = () => open.delete(notification)
  notification.onerror = () => { open.delete(notification); report('Windows popup delivery failed. Check browser and Windows notification settings.') }
  notification.onclick = event => {
    event.preventDefault()
    notification.close()
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }
  while (open.size > 100) { const oldest = open.values().next().value!; open.delete(oldest); oldest.close() }
}
export function stopNewsPopups() {
  for (const notification of open) notification.close()
  open.clear(); report('')
}
const stamp = (at: number) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jakarta', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true,
}).format(at) + ' WIB'

export async function showNewsPopups(items: NewsItem[], active: () => boolean, eligible: (item: NewsItem) => boolean = () => true) {
  const deliver = () => {
    if (!active() || !items.length) return
    if (popupPermission() !== 'granted') { report('Windows popups need browser permission. Open the headline alarm settings to enable them.'); return }
    readJournal()
    for (const item of items) {
      if (!active()) return
      if (!eligible(item)) continue
      let url: URL
      try { url = new URL(item.url) } catch { continue }
      if (!['http:', 'https:'].includes(url.protocol)) continue
      const key = identity(url.href)
      if (remembered.has(key)) continue
      const collected = item.received_at ?? item.first_seen
      const published = item.published_at !== null && item.published_at <= Date.now() && item.published_at - item.first_seen < 60000
        ? `Published ${stamp(item.published_at)}` : 'Publication time unavailable'
      const provider = item.publisher || item.source_name
      banner(item.title, `${provider}${item.relevance?.tier === 'priority' ? ' · Priority' : ''}\n${published}\nCollected ${stamp(collected)}`, `fyodor-news-${key}`, url.href)
      remember(key)
    }
    report('')
  }
  try {
    // Serialize simultaneous tabs where supported; otherwise use the journal and
    // stable notification tags to avoid stacking identical articles.
    if (navigator.locks?.request) await navigator.locks.request(journalKey, deliver)
    else deliver()
  } catch { if (active()) report('Could not show Windows popups. Use Test popup to check browser and Windows settings.') }
}

export function testNewsPopup() {
  if (popupPermission() !== 'granted') throw Error('Allow browser notifications before testing a popup.')
  banner('News Flow · Test notification', 'Headline popups are enabled for this browser.\n' + stamp(Date.now()), 'fyodor-news-test')
  report('')
}
