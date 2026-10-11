import type { NotebookPlanView } from './useNotebookPlan'
import { TradeWorkflowEditor } from '../workflow/TradeWorkflowEditor'

export function JournalColumn({ view }: { view: NotebookPlanView }) {
  const { canRegister, contextScope, handleNoteChange, handleRegisterClick, handleSaveNote, isNoteDirty, note, onPlanChange, plan, regSuccessMsg, saveStatus, selectedArrow, selectedSymbol } = view
  return (
      <div className="notebook-col notebook-journal-col">
        <div className="notebook-col-header">
          <span className="notebook-eyebrow">Trader Journal &amp; Thesis</span>
          <div className="journal-header-actions">
            {!selectedArrow && (
              <label className="header-chart-toggle" title="Show horizontal planned lines on chart">
                <input
                  type="checkbox"
                  checked={plan.showOnChart}
                  onChange={(e) => onPlanChange({ ...plan, showOnChart: e.target.checked })}
                />
                <span>Project on Chart</span>
              </label>
            )}

            <div className="header-meta-pill">
              <span className="meta-item">Scope: <strong>{selectedSymbol}</strong></span>
              <span className="meta-sep" aria-hidden="true">·</span>
              <span className="meta-item meta-durable">Durable</span>
              <span className="meta-sep" aria-hidden="true">·</span>
              <span className={`meta-item meta-status${isNoteDirty ? ' unsaved' : ''}`}>● {saveStatus}</span>
            </div>

            <button
              type="button"
              className={`save-note-btn-compact ${isNoteDirty ? 'ready' : 'saved'}`}
              onClick={handleSaveNote}
              disabled={!isNoteDirty}
              title={isNoteDirty ? 'Save note (Ctrl+Enter)' : 'Note saved'}
            >
              {isNoteDirty ? '💾 Save Note' : '✓ Saved'}
            </button>

            {!selectedArrow && (
              <button
                type="button"
                className={`register-arrow-btn-compact ${regSuccessMsg ? 'success' : canRegister ? 'ready' : 'disabled'}`}
                onClick={handleRegisterClick}
                disabled={!canRegister}
                title={canRegister ? 'Pin this setup arrow to chart' : 'Set Entry, SL, and TP to pin arrow'}
              >
                {regSuccessMsg ? '✓ Pinned!' : '↗ Pin Arrow'}
              </button>
            )}
          </div>
        </div>

        <div className="notebook-workflow-scroll">
        <TradeWorkflowEditor workflow={selectedArrow ? selectedArrow.workflow : plan.workflow} readOnly={!!selectedArrow}
          onChange={workflow => onPlanChange({ ...plan, workflow })} symbol={selectedSymbol} scope={contextScope} />
        <div className="journal-textarea-container">
          <textarea
            className="journal-textarea"
            value={note}
            onChange={handleNoteChange}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isNoteDirty) {
                e.preventDefault()
                handleSaveNote()
              }
            }}
            placeholder={`Type your trade thesis, catalyst observation, technical structure, or post-trade audit notes for ${selectedSymbol}...\n\nClick "Save Note" or press Ctrl+Enter to preserve locally.`}
            aria-label="Trader journal note"
          />
        </div>
        </div>
      </div>
  )
}
