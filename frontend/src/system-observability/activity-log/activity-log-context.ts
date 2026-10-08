import { createContext } from 'react'
import type { ActivityLogEntry, ActivitySeverity, ActivitySource } from './activity-log-entry'

export type AppendActivityOptions = {
  occurredAt?: number
  severity?: ActivitySeverity
}

export type ActivityLogState = {
  entries: ActivityLogEntry[]
  appendActivity: (source: ActivitySource, action: string, detail?: string, options?: AppendActivityOptions) => void
  clearActivity: () => void
}

export type ActivityLogActions = Pick<ActivityLogState, 'appendActivity' | 'clearActivity'>
export const ActivityLogActionsContext = createContext<ActivityLogActions | null>(null)
export const ActivityLogEntriesContext = createContext<ActivityLogEntry[] | null>(null)
