import { useContext } from 'react'
import { ActivityLogActionsContext, ActivityLogEntriesContext } from './activity-log-context'

export function useActivityActions() {
  const context = useContext(ActivityLogActionsContext)
  if (!context) throw new Error('useActivityLog must be used inside ActivityLogProvider')
  return context
}

export function useActivityEntries() {
  const entries = useContext(ActivityLogEntriesContext)
  if (!entries) throw new Error('useActivityLog must be used inside ActivityLogProvider')
  return entries
}

export function useActivityLog() {
  return { ...useActivityActions(), entries: useActivityEntries() }
}
