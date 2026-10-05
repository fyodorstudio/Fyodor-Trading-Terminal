import { useEffect, useRef, useState } from 'react'
import { exportWorkspace, parseWorkspaceSnapshot, restoreWorkspace, workspaceMaxBytes, type WorkspaceSnapshot } from './workspace-snapshot'
import './workspace-transfer.css'

export function WorkspaceTransfer({ onReload = () => window.location.reload() }: { onReload?: () => void }) {
  const [pending, setPending] = useState<WorkspaceSnapshot | null>(null)
  const [message, setMessage] = useState('')
  const request = useRef(0)
  useEffect(() => () => { request.current++ }, [])
  return <div className="chart-settings-section workspace-transfer">
    <h2>Workspace backup</h2>
    <p>Export saved filters, magnitude boundaries, colors, dock sizes, drawings and notebook entries. Calendar data is backed up separately.</p>
    <button type="button" onClick={() => {
      try {
        const snapshot = exportWorkspace()
        const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }))
        const link = document.createElement('a')
        link.href = url; link.download = `fyodor-workspace-${snapshot.exportedAt.slice(0, 10)}.json`
        document.body.appendChild(link); link.click(); link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        setMessage('Workspace export downloaded.')
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Export failed') }
    }}>Export workspace</button>
    <label>Import workspace<input type="file" accept=".json,application/json" aria-label="Import workspace" onChange={async (event) => {
      const id = ++request.current, file = event.target.files?.[0]
      setPending(null); setMessage(''); event.target.value = ''
      if (!file) return
      try {
        if (file.size > workspaceMaxBytes) throw new Error('Workspace file exceeds 10 MB')
        const snapshot = parseWorkspaceSnapshot(await file.text())
        if (id === request.current) setPending(snapshot)
      } catch (error) { if (id === request.current) setMessage(error instanceof Error ? error.message : 'Import failed') }
    }} /></label>
    {pending && <div>
      <p>{Object.keys(pending.entries).length} saved entries · exported {pending.exportedAt.slice(0, 10)}. Restore replaces this browser’s saved workspace and reloads the app. Save any drafts first.</p>
      <button type="button" onClick={() => {
        try { restoreWorkspace(pending); setPending(null); onReload() }
        catch (error) { setMessage(error instanceof Error ? error.message : 'Restore failed') }
      }}>Restore and reload</button>
      <button type="button" onClick={() => setPending(null)}>Cancel import</button>
    </div>}
    {message && <p role="status">{message}</p>}
  </div>
}
