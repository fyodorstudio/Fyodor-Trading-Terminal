import { useState } from 'react'
import type { EntryTradePlanView } from './useEntryTradePlan'
import { clearJournalDraft, journalKey, readJournalDraft, savedSymbolJournal, writeJournalDraft } from '../storage/journal-drafts'

export function JournalColumn({ view }: { view: EntryTradePlanView }) {
  const { selectedArrow, selectedSymbol, onUpdateArrow } = view
  const key = journalKey(selectedSymbol, selectedArrow?.id)
  const saved = selectedArrow?.note ?? savedSymbolJournal(selectedSymbol)
  const [scope, setScope] = useState(key)
  const [note, setNote] = useState(() => readJournalDraft(key, saved))
  const [error, setError] = useState(false)
  if (scope !== key) {
    setScope(key); setNote(readJournalDraft(key, saved)); setError(false)
  }
  const save = () => {
    try {
      if (selectedArrow) onUpdateArrow(selectedArrow.id, { note })
      else localStorage.setItem(`trader_notebook_note_${selectedSymbol}`, note)
      clearJournalDraft(key); setError(false)
      setScope('')
    } catch { setError(true) }
  }
  return <div className="entry-trade-col entry-trade-journal-col">
    <textarea className="journal-textarea" value={note}
      onChange={event => { const value = event.target.value; setNote(value); writeJournalDraft(key, value) }}
      onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); save() } }}
      placeholder="Trade journal & thesis…" aria-label="Trader journal note" />
    <div className="journal-save-row">
      {error && <span role="alert">Note could not be saved.</span>}
      <button type="button" className="new-draft-btn-compact" onClick={save} disabled={note === saved && !error}>Save</button>
    </div>
  </div>
}
