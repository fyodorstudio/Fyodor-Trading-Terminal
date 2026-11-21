import assert from 'node:assert/strict'

export async function checkBrowserPopups({ server, dom, root, React, control, pending, reply, click, timers, requests }) {
  const originalNotification = Object.getOwnPropertyDescriptor(dom, 'Notification')
  const originalSecure = Object.getOwnPropertyDescriptor(dom, 'isSecureContext')
  const originalLocks = Object.getOwnPropertyDescriptor(dom.navigator, 'locks')
  const originalOpen = dom.open
  const shown = [], opened = []
  class Toast {
    static permission = 'default'
    static prompts = 0
    static fail = false
    static async requestPermission() { this.prompts++; this.permission = 'granted'; return this.permission }
    constructor(title, options) {
      if (Toast.fail) throw Error('OS unavailable')
      this.title = title; this.options = options; shown.push(this)
    }
    close() { this.closed = true; this.onclose?.() }
  }
  Object.defineProperty(dom, 'Notification', { configurable: true, value: Toast })
  Object.defineProperty(dom, 'isSecureContext', { configurable: true, value: true })
  dom.open = (...args) => opened.push(args)
  const { useNewsSettings } = await server.ssrLoadModule('./src/news-flow/settings.ts')
  const { readNewsSettings } = await server.ssrLoadModule('./src/news-flow/model.ts')
  const { NewsSoundAlerts } = await server.ssrLoadModule('./src/news-flow/NewsSoundAlerts.tsx')
  const { NewsAlarmControls } = await server.ssrLoadModule('./src/news-flow/NewsAlarm.tsx')
  const { NewsPopupSettings } = await server.ssrLoadModule('./src/news-flow/NewsPopupSettings.tsx')
  const popup = await server.ssrLoadModule('./src/news-flow/browser-notifications.ts')
  const { saveNewsAlertProfile } = await server.ssrLoadModule('./src/news-flow/alert-profile.ts')
  const now = Date.now()
  const item = (id, extra = {}) => ({ id, title: `Nvidia news ${id}`, source_id: 'reuters', source_name: 'Reuters', publisher: 'Reuters',
    url: `https://example.com/popup/${id}`, summary: '', published_at: now, first_seen: now, received_at: now,
    relevance: { included: true, tier: 'priority', reason: 'Included · Nvidia', keyword: 'Nvidia' }, ...extra })
  function Harness() {
    const [settings, change] = useNewsSettings()
    return React.createElement(React.Fragment, null, React.createElement(NewsSoundAlerts), React.createElement(NewsAlarmControls, { settings, onChange: change }))
  }
  async function save() {
    await click('Save news alert settings')
    const request = pending('/notifications/settings')
    if (request) await reply(request, { ...JSON.parse(request.body), unified_alerts: true, connection: null, error: '', last_sent: null })
  }
  function PopupHarness() {
    const [settings, change] = useNewsSettings()
    return React.createElement(NewsPopupSettings, { enabled: settings.browserNotifications, onChange: enabled => change(old => ({ ...old, browserNotifications: enabled })) })
  }
  async function tick() {
    const timer = [...timers].find(([, value]) => value.ms === 1000)
    assert.ok(timer, 'Arrival listener timer')
    await React.act(async () => { timers.delete(timer[0]); timer[1].fn() })
  }
  try {
    dom.localStorage.removeItem('fyodor.news-flow.alert-cursor.v1')
    dom.localStorage.setItem('fyodor.news-flow.v1', JSON.stringify({ ...readNewsSettings(), browserNotifications: 'true' }))
    assert.equal(readNewsSettings().browserNotifications, false, 'Only explicit boolean opt-in enables popups')
    dom.localStorage.setItem('fyodor.news-flow.v1', JSON.stringify({ ...readNewsSettings(), browserNotifications: false, soundEnabled: false }))
    await React.act(async () => root.render(React.createElement(Harness)))
    assert.equal(control('Windows headline popups').checked, false)
    assert.equal(Toast.prompts, 0, 'No permission prompt on load')
    assert.equal(control('Test Windows headline popup').disabled, true)
    await reply(requests.findLast(request => !request.answered && !request.signal?.aborted && request.url === '/storage-api/news-flow/notifications'), { mode: 'included', max_age_seconds: 86400, unified_alerts: true, connection: null, error: '', last_sent: null })
    await reply(pending('/notifications/rules'), { mode: 'included' })
    await reply(pending('/arrivals'), { cursor: 10, items: [item('startup', { sequence: 10 })] })
    assert.equal(shown.length, 0, 'Startup does not generate notifications')

    Toast.permission = 'denied'
    await click('Windows headline popups')
    assert.equal(readNewsSettings().browserNotifications, false)
    assert.equal(Toast.prompts, 0, 'A denied permission is not repeatedly requested')
    assert.match(dom.document.body.textContent, /Notifications are blocked/)
    Toast.permission = 'default'
    await click('Windows headline popups')
    assert.equal(Toast.prompts, 1)
    assert.equal(readNewsSettings().browserNotifications, false, 'Permission does not save the draft')
    await save()
    assert.equal(readNewsSettings().browserNotifications, true)
    await click('Test Windows headline popup')
    assert.equal(shown.length, 1)
    assert.equal(shown[0].options.silent, true)
    assert.match(dom.document.body.textContent, /Test requested/)

    await tick()
    await reply(pending('/arrivals'), { cursor: 11, items: [item('fresh', { sequence: 11 })] })
    assert.equal(shown.length, 2, 'A new eligible headline displays even when audio is blocked')
    assert.equal(shown[1].title, 'Nvidia news fresh')
    assert.match(shown[1].options.body, /Reuters · Priority 1/)
    assert.match(shown[1].options.body, /Published.*(?:AM|PM) WIB/)
    assert.match(shown[1].options.body, /Collected/)
    assert.equal(shown[1].options.requireInteraction, false)
    let prevented = false
    shown[1].onclick({ preventDefault: () => { prevented = true } })
    assert.equal(prevented, true)
    assert.deepEqual(opened, [['https://example.com/popup/fresh', '_blank', 'noopener,noreferrer']])
    await tick()
    assert.equal(new URL(pending('/arrivals').url, 'http://localhost').searchParams.get('after'), '10', 'Audio still retains its own retry cursor')
    await reply(pending('/arrivals'), { cursor: 11, items: [item('fresh', { sequence: 11 })] })
    assert.equal(shown.length, 2, 'Audio retry never repeats the popup')
    await tick()
    await reply(pending('/arrivals'), { cursor: 12, items: [item('overlap', { url: item('fresh').url, sequence: 12 })] })
    assert.equal(shown.length, 2, 'Overlapping provider URLs do not repeat a popup')
    await tick()
    await reply(pending('/arrivals'), { cursor: 13, items: [item('old', { published_at: now - 6 * 86400000, sequence: 13 })] })
    assert.equal(shown.length, 2, 'The shared publication-age limit also protects popups')
    await tick()
    await reply(pending('/arrivals'), { cursor: 14, items: [item('unknown', { published_at: null, sequence: 14 })] })
    assert.equal(shown.length, 2)

    await click('Windows headline popups')
    await save()
    assert.equal(readNewsSettings().browserNotifications, false)
    assert.equal(shown[0].closed, true, 'Disabling closes outstanding banners')
    await tick()
    await reply(pending('/arrivals'), { cursor: 15, items: [item('off', { sequence: 15 })] })
    await click('Windows headline popups')
    await save()
    assert.equal(Toast.prompts, 1, 'Existing browser permission is reused')
    await tick()
    await reply(pending('/arrivals'), { cursor: 15, items: [item('off', { sequence: 15 })] })
    assert.equal(shown.length, 2, 'Enabling does not replay pending sound or off-period news')
    await tick()
    await reply(pending('/arrivals'), { cursor: 16, items: [item('next', { sequence: 16 })] })
    assert.equal(shown.length, 3)
    let releaseToggle
    Object.defineProperty(dom.navigator, 'locks', { configurable: true, value: { request: (_name, callback) => new Promise(resolve => { releaseToggle = () => resolve(callback()) }) } })
    await tick()
    await reply(pending('/arrivals'), { cursor: 17, items: [item('toggle-queued', { sequence: 17 })] })
    assert.equal(typeof releaseToggle, 'function')
    await click('Windows headline popups')
    await save()
    await click('Windows headline popups')
    await save()
    await React.act(async () => releaseToggle())
    assert.equal(shown.length, 3, 'Off/on invalidates already queued work even when permission remains granted')
    Object.defineProperty(dom.navigator, 'locks', { configurable: true, value: undefined })
    Toast.permission = 'denied'
    await tick()
    await reply(pending('/arrivals'), { cursor: 18, items: [item('revoked', { sequence: 18 })] })
    assert.equal(shown.length, 3)
    assert.equal(Toast.prompts, 1, 'Polling never asks for notification permission')
    assert.match(dom.document.body.textContent, /Windows popups need browser permission/)
    Toast.permission = 'granted'

    await tick()
    const stale = pending('/arrivals')
    await React.act(async () => { void saveNewsAlertProfile('off', 86400) })
    assert.equal(stale.signal.aborted, true)
    await reply(pending('/notifications/settings'), { mode: 'off', max_age_seconds: 86400, unified_alerts: true, connection: null, error: '', last_sent: null })
    await reply(stale, { cursor: 19, items: [item('stale', { sequence: 19 })] })
    assert.equal(shown.length, 3, 'A response aborted by the shared Off trigger cannot show a popup')
    await React.act(async () => root.render(null))
    assert.equal(timers.size, 0)
    assert.equal(shown[2].closed, true)

    // A fresh module simulates reload/another tab reading the saved URL journal.
    const reloaded = await server.ssrLoadModule('./src/news-flow/browser-notifications.ts?journal-reload')
    await reloaded.showNewsPopups([item('fresh')], () => true)
    assert.equal(shown.length, 3)
    Toast.fail = true
    await popup.showNewsPopups([item('recover')], () => true)
    assert.equal(shown.length, 3)
    Toast.fail = false
    await popup.showNewsPopups([item('recover')], () => true)
    assert.equal(shown.length, 4, 'Constructor failure does not mark an undelivered popup as sent')
    let release, active = true, eligible = true
    Object.defineProperty(dom.navigator, 'locks', { configurable: true, value: { request: (_name, callback) => new Promise(resolve => { release = () => resolve(callback()) }) } })
    const stopped = popup.showNewsPopups([item('queued')], () => active)
    active = false; release(); await stopped
    assert.equal(shown.length, 4, 'Disabled/unmounted work cannot deliver after waiting for another tab')
    const expired = popup.showNewsPopups([item('expired-in-lock')], () => true, () => eligible)
    eligible = false; release(); await expired
    assert.equal(shown.length, 4, 'Publication eligibility is checked again after a delivery lock')
    Object.defineProperty(dom.navigator, 'locks', { configurable: true, value: undefined })
    await popup.showNewsPopups([item('invalid', { url: 'not a URL' }), item('unsafe', { url: 'javascript:alert(1)' })], () => true)
    assert.equal(shown.length, 4, 'Invalid or executable article URLs never create clickable popups')
    dom.localStorage.setItem('fyodor.news-flow.v1', JSON.stringify({ ...readNewsSettings(), browserNotifications: false }))
    Toast.permission = 'default'
    let allowLate
    const originalRequest = Toast.requestPermission
    Toast.requestPermission = () => new Promise(resolve => { allowLate = () => { Toast.permission = 'granted'; resolve('granted') } })
    await React.act(async () => root.render(React.createElement(PopupHarness)))
    await click('Windows headline popups')
    await React.act(async () => root.render(null))
    await React.act(async () => allowLate())
    assert.equal(readNewsSettings().browserNotifications, false, 'Closing settings cancels a late permission response')
    Toast.requestPermission = originalRequest
    Object.defineProperty(dom, 'isSecureContext', { configurable: true, value: false })
    await assert.rejects(popup.allowNewsPopups(), /localhost or HTTPS/)
    Object.defineProperty(dom, 'Notification', { configurable: true, value: undefined })
    await assert.rejects(popup.allowNewsPopups(), /does not support/)
    popup.stopNewsPopups(); reloaded.stopNewsPopups()
    console.log('✓ Browser popups: explicit permission/opt-in, persisted toggle, silent clickable WIB banners, scoped age, independent audio cursor, dedup/reload, cancellation, errors and cleanup')
  } finally {
    await React.act(async () => root.render(null))
    for (const [target, key, descriptor] of [[dom, 'Notification', originalNotification], [dom, 'isSecureContext', originalSecure], [dom.navigator, 'locks', originalLocks]]) {
      if (descriptor) Object.defineProperty(target, key, descriptor); else delete target[key]
    }
    dom.open = originalOpen
    popup.stopNewsPopups()
  }
}
