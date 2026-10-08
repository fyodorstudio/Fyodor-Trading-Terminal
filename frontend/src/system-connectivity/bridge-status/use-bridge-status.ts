import { useEffect, useRef, useState } from 'react'
import type { ActivitySeverity, ActivitySource } from '../../system-observability/activity-log/activity-log-entry'
import { useActivityActions } from '../../system-observability/activity-log/use-activity-log'
import { bridgeRequest } from './bridge-client'
import type { BridgeActivityEvent, BridgeHealth } from './bridge-contract'

type ActivityResponse = {
  events: BridgeActivityEvent[]
  latest_sequence: number
}

const supportedRemoteSources = new Set<ActivitySource>(['Bridge', 'MT5', 'Calendar'])

export type BridgeStatusState = {
  health: BridgeHealth | null
  reachable: boolean
  lastContactAt: number | null
  roundTripMs: number | null
  probeStartedAt: number | null
  clockOffsetMs: number
  error: string | null
}

export function useBridgeStatus(): BridgeStatusState {
  const { appendActivity } = useActivityActions()
  const [state, setState] = useState<BridgeStatusState>({
    health: null,
    reachable: false,
    lastContactAt: null,
    roundTripMs: null,
    probeStartedAt: null,
    clockOffsetMs: 0,
    error: null,
  })
  const reachableRef = useRef<boolean | null>(null)
  const activitySequenceRef = useRef(0)
  const bridgeStartedAtRef = useRef<number | null>(null)
  const publisherRef = useRef<string | null>(null)

  useEffect(() => {
    let disposed = false
    let healthTimer: number | undefined
    let activityTimer: number | undefined
    let healthController: AbortController | null = null
    let activityController: AbortController | null = null
    let healthAbortTimer: number | undefined
    let activityAbortTimer: number | undefined

    const pollHealth = async () => {
      const startedAt = Date.now()
      setState((current) => ({ ...current, probeStartedAt: startedAt }))
      healthController = new AbortController()
      let timedOut = false
      healthAbortTimer = window.setTimeout(() => {
        timedOut = true
        healthController?.abort()
      }, 5_000)
      try {
        const health = await bridgeRequest<BridgeHealth>('/health', healthController.signal)
        const finishedAt = Date.now()
        if (disposed) return
        if (bridgeStartedAtRef.current !== null && bridgeStartedAtRef.current !== health.bridge.started_at) {
          activitySequenceRef.current = 0
        }
        bridgeStartedAtRef.current = health.bridge.started_at
        if (reachableRef.current !== true) {
          appendActivity('Bridge', 'Bridge reachable', `API v${health.api_version}`, { severity: 'success' })
        }
        reachableRef.current = true
        const calendar = health.calendar
        const publisherKey = JSON.stringify([health.bridge.started_at, calendar.instance_id, calendar.status])
        if (publisherRef.current !== publisherKey) {
          const actions = { live: 'Publisher live', stale: 'Publisher stale',
            'awaiting-snapshot': 'Publisher awaiting snapshot', 'waiting-for-publisher': 'Waiting for publisher' }
          appendActivity('Calendar', actions[calendar.status], calendar.instance_id ?? undefined,
            { severity: calendar.status === 'live' ? 'success' : calendar.status === 'stale' ? 'warning' : 'info' })
          publisherRef.current = publisherKey
        }
        const roundTripMs = finishedAt - startedAt
        const estimatedBridgeNow = health.bridge.now + roundTripMs / 2
        setState({
          health,
          reachable: true,
          lastContactAt: finishedAt,
          roundTripMs,
          probeStartedAt: null,
          clockOffsetMs: estimatedBridgeNow - finishedAt,
          error: null,
        })
      } catch (error) {
        if (disposed || (error instanceof DOMException && error.name === 'AbortError' && !timedOut)) return
        const message = timedOut
          ? 'Bridge health probe timed out after 5 seconds'
          : error instanceof Error ? error.message : 'Bridge request failed'
        if (reachableRef.current !== false) {
          appendActivity('Bridge', 'Bridge unreachable', message, { severity: 'error' })
        }
        reachableRef.current = false
        setState((current) => ({
          ...current,
          reachable: false,
          probeStartedAt: null,
          error: message,
        }))
      } finally {
        if (healthAbortTimer) window.clearTimeout(healthAbortTimer)
        if (!disposed) healthTimer = window.setTimeout(pollHealth, 2_000)
      }
    }

    const pollActivity = async () => {
      activityController = new AbortController()
      activityAbortTimer = window.setTimeout(() => activityController?.abort(), 5_000)
      try {
        const response = await bridgeRequest<ActivityResponse>(
          `/activity?after=${activitySequenceRef.current}`,
          activityController.signal,
        )
        if (disposed) return
        for (const event of response.events) {
          const source = supportedRemoteSources.has(event.source as ActivitySource)
            ? event.source as ActivitySource
            : 'Bridge'
          appendActivity(source, event.action, event.detail ?? undefined, {
            occurredAt: event.occurred_at,
            severity: event.severity as ActivitySeverity,
          })
        }
        activitySequenceRef.current = response.latest_sequence
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          // Health polling owns the visible unreachable transition.
        }
      } finally {
        if (activityAbortTimer) window.clearTimeout(activityAbortTimer)
        if (!disposed) activityTimer = window.setTimeout(pollActivity, 1_000)
      }
    }

    void pollHealth()
    void pollActivity()
    return () => {
      disposed = true
      healthController?.abort()
      activityController?.abort()
      if (healthTimer) window.clearTimeout(healthTimer)
      if (activityTimer) window.clearTimeout(activityTimer)
      if (healthAbortTimer) window.clearTimeout(healthAbortTimer)
      if (activityAbortTimer) window.clearTimeout(activityAbortTimer)
    }
  }, [appendActivity])

  return state
}
