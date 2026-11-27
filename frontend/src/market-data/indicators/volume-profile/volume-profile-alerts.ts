import type { ProfileRow, ProfileWindow } from './volume-profile'

export const profileNodes = ['POC', 'HVN', 'LVN'] as const
export type ProfileNode = typeof profileNodes[number]
export type ProfileAlertTrigger = 'new-level' | 'touch' | 'both'
export type ProfileAlertEvent = { type: 'new-level' | 'touch'; low: number; high: number }
export type ProfileAlert = {
  id: string
  broker: string
  symbol: string
  node: ProfileNode
  lookbackMinutes: number
  fixed?: ProfileWindow
  trigger: ProfileAlertTrigger
  repeat: boolean
  armed: boolean
  sent: ProfileAlertEvent[]
  last?: { message: string; time: number }
}

export const profileAlertStorageKey = 'fyodor.volume-profile-alerts.v1'

export function readProfileAlerts(): ProfileAlert[] {
  try {
    const values: unknown = JSON.parse(window.localStorage.getItem(profileAlertStorageKey) ?? '[]')
    if (!Array.isArray(values)) return []
    return values.filter(alert => alert && typeof alert.id === 'string' && typeof alert.symbol === 'string' &&
      typeof alert.broker === 'string' && profileNodes.includes(alert.node) && Number.isSafeInteger(alert.lookbackMinutes) &&
      alert.lookbackMinutes > 0 && ['new-level', 'touch', 'both'].includes(alert.trigger) &&
      typeof alert.armed === 'boolean' && typeof alert.repeat === 'boolean' && Array.isArray(alert.sent))
  } catch { return [] }
}

export function sameProfileLevel(first: Pick<ProfileRow, 'low' | 'high'>, second: Pick<ProfileRow, 'low' | 'high'>) {
  const overlap = Math.min(first.high, second.high) - Math.max(first.low, second.low)
  return overlap > 0 && overlap >= Math.min(first.high - first.low, second.high - second.low) * 0.5
}

export function profileAlertEvents(nodes: ProfileRow[], previousNodes: ProfileRow[],
  previousPrice: number | undefined, price: number | undefined, alert: ProfileAlert) {
  const events: ProfileAlertEvent[] = []
  const add = (type: ProfileAlertEvent['type'], { low, high }: ProfileRow) => {
    if (alert.repeat || !alert.sent.some(event => event.type === type && sameProfileLevel(event, { low, high })))
      events.push({ type, low, high })
  }
  if (alert.trigger !== 'new-level' && price !== undefined && previousPrice !== undefined) {
    for (const node of previousNodes) {
      if ((previousPrice < node.low && price >= node.low) || (previousPrice > node.high && price <= node.high)) add('touch', node)
    }
  }
  if (alert.trigger !== 'touch') {
    for (const node of nodes) if (!previousNodes.some(previous => sameProfileLevel(previous, node))) add('new-level', node)
  }
  return events
}
