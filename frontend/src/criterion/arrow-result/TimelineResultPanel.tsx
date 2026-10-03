import { useState } from 'react'
import {
  CpiEventTimelineTable,
  type TimelineReleaseBlock,
  type TimelineSeriesRow,
} from '../timeline/CpiEventTimelineTable'
import type { CpiTimelineEpisodePayload } from '../timeline/cpi-event-timeline-data'
import { downloadAuditNotes, type AuditNote } from './audit-notes'
import './arrow-result-panel.css'

export type TimelineResultPanelProps = {
  episodePayload?: CpiTimelineEpisodePayload | null
  blocks?: TimelineReleaseBlock[] | null
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  selectedRowKey?: string | null
  onSelectRow?: (block: TimelineReleaseBlock, row: TimelineSeriesRow, key: string) => void
  note?: string
  notes?: AuditNote[]
  saveFailed?: boolean
  onNoteChange?: (text: string) => void
  onReturnLive?: () => void
}

export function TimelineResultPanel({
  episodePayload = null,
  blocks = null,
  isLoading = false,
  error = null,
  onRetry,
  selectedRowKey = null,
  onSelectRow,
  note = '',
  notes = [],
  saveFailed = false,
  onNoteChange = () => {},
  onReturnLive,
}: TimelineResultPanelProps) {
  const [copyStatus, setCopyStatus] = useState('')
  const [prevNote, setPrevNote] = useState(note)
  const [draftNote, setDraftNote] = useState(note)
  const [justSaved, setJustSaved] = useState(false)

  if (note !== prevNote) {
    setPrevNote(note)
    setDraftNote(note)
    setJustSaved(false)
  }

  const isDirty = draftNote !== note

  const handleSaveNote = () => {
    onNoteChange(draftNote)
    setJustSaved(true)
  }

  const activeBlocks = episodePayload
    ? [episodePayload.cpiBlock, ...episodePayload.surroundingBlocks]
    : blocks

  const episodeId = episodePayload?.episodeId ?? 'CPI_TIMELINE'
  const releaseText = episodePayload?.releaseTimeText ?? 'Historical Episode'

  const copyNote = async () => {
    try {
      await navigator.clipboard.writeText(
        [
          `CPI_TIMELINE / EURUSD / ${releaseText}`,
          `Episode: ${episodeId}`,
          `Rule: H240 · SL 1 ATR · TP 1 ATR · STOP_FIRST`,
          '',
          draftNote,
        ].join('\n')
      )
      setCopyStatus('Copied')
    } catch {
      setCopyStatus('Copy unavailable; use Export all')
    }
  }

  if (isLoading) {
    return (
      <div className="arrow-result-empty" role="status">
        Loading audited episode timeline payload...
      </div>
    )
  }

  if (error) {
    return (
      <div className="arrow-result-empty error" role="alert">
        <p><strong>Error loading episode:</strong> {error}</p>
        {onRetry && (
          <button
            type="button"
            className="criterion-retry-btn"
            onClick={onRetry}
            style={{ marginTop: '8px', cursor: 'pointer' }}
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  if (!activeBlocks || activeBlocks.length === 0) {
    return (
      <section className="arrow-result-panel" aria-label="CPI & Event Timeline Result Panel">
        <header className="arrow-result-header">
          <div className="arrow-result-title">
            <strong>CPI &amp; Event Timeline</strong>
            <span>Exploratory Research · Unregistered</span>
          </div>
          {onReturnLive && (
            <div className="arrow-result-actions">
              <button
                type="button"
                className="arrow-result-return"
                onClick={onReturnLive}
                aria-label="Return to live chart view"
              >
                Back to live
              </button>
            </div>
          )}
        </header>

        <div className="arrow-result-body">
          <CpiEventTimelineTable
            blocks={null}
            pendingMessage="Research pending — no audited results published."
          />
        </div>
      </section>
    )
  }

  return (
    <section className="arrow-result-panel timeline-result-layout" aria-label="CPI & Event Timeline Result Panel">
      <div className="timeline-main-col">
        <header className="arrow-result-col-header timeline-dock-header">
          <div className="arrow-result-identity">
            <strong>
              CPI &amp; Event Timeline <span>EURUSD</span>
            </strong>
            <span className="arrow-result-meta">{releaseText} anchor release · H240 · server clock</span>
          </div>
          {onReturnLive && (
            <button
              type="button"
              className="arrow-result-text-button"
              onClick={onReturnLive}
              aria-label="Return to live chart view"
            >
              Return to live
            </button>
          )}
        </header>

        <div className="timeline-table-scroll-area">
          <CpiEventTimelineTable
            blocks={activeBlocks}
            horizon={240}
            stop={1}
            target={1}
            selectedRowKey={selectedRowKey}
            onSelectRow={onSelectRow}
          />
        </div>
      </div>

      <div className="arrow-result-col arrow-result-journal timeline-journal-col">
        <header className="arrow-result-col-header">
          <div className="arrow-result-header-title">
            <span className="arrow-result-eyebrow">AUDIT JOURNAL &amp; THESIS</span>
          </div>
          <span
            className={`arrow-result-rule-chip save-status ${
              saveFailed ? 'failed' : isDirty ? 'unsaved' : note.trim() ? 'saved' : 'empty'
            }`}
          >
            {saveFailed ? 'Failed to save' : isDirty ? '● Unsaved' : note.trim() ? '● Saved' : 'No note'}
          </span>
        </header>

        <div className="arrow-result-journal-subbar">
          <span className="arrow-result-journal-meta">{releaseText}</span>
          <div className="arrow-result-journal-actions">
            <button
              type="button"
              className={`save-note-btn${isDirty ? ' ready' : ''}`}
              onClick={handleSaveNote}
              disabled={!isDirty}
              title={isDirty ? 'Save note (Ctrl+Enter)' : 'Note saved'}
            >
              {isDirty ? 'Save Note' : justSaved ? 'Saved' : 'Save Note'}
            </button>
            <button type="button" onClick={copyNote} disabled={!draftNote.trim()}>
              Copy
            </button>
            <button
              type="button"
              onClick={() => downloadAuditNotes(notes)}
              disabled={notes.length === 0}
            >
              Export .md{notes.length > 0 ? ` (${notes.length})` : ''}
            </button>
            {copyStatus && <span role="status">{copyStatus}</span>}
          </div>
        </div>

        <textarea
          id="criterion-audit-note"
          className="arrow-result-note"
          value={draftNote}
          onChange={(event) => {
            setDraftNote(event.target.value)
            setJustSaved(false)
          }}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && isDirty) {
              event.preventDefault()
              handleSaveNote()
            }
          }}
          placeholder="Personal chart observations and thesis on this episode..."
        />

        <div className="arrow-result-evidence-footer">
          <div
            className="arrow-result-caveat-line"
            title="Notes survive refresh in this browser only. Export Markdown to preserve and share."
          >
            <span className="arrow-result-info-icon" aria-hidden="true">
              ⓘ
            </span>
            <span className="arrow-result-caveat-text">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'} in localStorage · Export to share with Codex
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
