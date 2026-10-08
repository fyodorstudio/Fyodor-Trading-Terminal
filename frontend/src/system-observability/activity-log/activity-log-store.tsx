import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ActivityLogActionsContext, ActivityLogEntriesContext } from './activity-log-context'
import type { AppendActivityOptions } from './activity-log-context'
import type { ActivityLogEntry, ActivitySource } from './activity-log-entry'

export function ActivityLogProvider({ children }: { children: ReactNode }) {
  const sequence = useRef(1)
  const [entries, setEntries] = useState<ActivityLogEntry[]>(() => [
    {
      id: 'startup-0',
      occurredAt: Date.now(),
      source: 'Application',
      action: 'Interface started',
      detail: 'Waiting for the local bridge',
      severity: 'info',
    },
  ])

  const appendActivity = useCallback((source: ActivitySource, action: string, detail?: string, options?: AppendActivityOptions) => {
    const occurredAt = options?.occurredAt ?? Date.now()
    setEntries((current) => {
      const latest = current.at(-1)
      if (
        latest &&
        latest.source === source &&
        latest.action === action &&
        latest.detail === detail &&
        occurredAt - latest.occurredAt < 300
      ) {
        return current
      }

      const next: ActivityLogEntry = {
        id: `${occurredAt}-${sequence.current++}`,
        occurredAt,
        source,
        action,
        detail,
        severity: options?.severity ?? 'info',
      }
      return [...current.slice(-199), next]
    })
  }, [])

  const clearActivity = useCallback(() => setEntries([]), [])
  const value = useMemo(
    () => ({ appendActivity, clearActivity }),
    [appendActivity, clearActivity],
  )

  return (
    <ActivityLogActionsContext.Provider value={value}>
      <ActivityLogEntriesContext.Provider value={entries}>
        {children}
      </ActivityLogEntriesContext.Provider>
    </ActivityLogActionsContext.Provider>
  )
}
