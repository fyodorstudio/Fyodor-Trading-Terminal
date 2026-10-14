// Unsaved edits survive dock/arrow switches, independently of persisted records.
const drafts = new Map<string, string>()
export const journalKey = (symbol: string, arrowId?: string) => arrowId ? `arrow:${arrowId}` : `draft:${symbol}`
export const readJournalDraft = (key: string, saved: string) => drafts.get(key) ?? saved
export const writeJournalDraft = (key: string, note: string) => { drafts.set(key, note) }
export const clearJournalDraft = (key: string) => { drafts.delete(key) }
export function savedSymbolJournal(symbol: string) {
  try { return localStorage.getItem(`trader_notebook_note_${symbol}`) ?? '' }
  catch { return '' }
}
