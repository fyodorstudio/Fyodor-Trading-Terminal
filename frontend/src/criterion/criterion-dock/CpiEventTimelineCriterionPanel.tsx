import { useMemo, useState } from 'react'
import type { PriorContextBars } from '../audit-data'
import type { AuditNote } from '../arrow-result/audit-notes'
import type { CpiTimelineIndex } from '../timeline/cpi-event-timeline-data'
import '../criterion-dock/criterion-panel.css'
import '../timeline/cpi-event-timeline.css'

export type CpiEventTimelineCriterionPanelProps = {
  index?: CpiTimelineIndex | null
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  selectedEpisodeId?: string | null
  onSelectEpisode?: (episodeId: string) => void
  priorContextBars?: PriorContextBars
  onPriorContextChange?: (bars: PriorContextBars) => void
  savedAuditNotes?: AuditNote[]
  pendingNotice?: string
}

export function CpiEventTimelineCriterionPanel({
  index = null,
  isLoading = false,
  error = null,
  onRetry,
  selectedEpisodeId = null,
  onSelectEpisode = () => {},
  priorContextBars = 240,
  onPriorContextChange = () => {},
  savedAuditNotes = [],
  pendingNotice = 'Research pending — no audited results published.',
}: CpiEventTimelineCriterionPanelProps) {
  const [selectedYear, setSelectedYear] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const notedEpisodeIds = useMemo(() => {
    return new Set(
      savedAuditNotes
        .filter((note) => note.family === 'CPI_TIMELINE')
        .map((note) => note.episodeId)
    )
  }, [savedAuditNotes])

  const episodes = useMemo(() => {
    if (!index || !index.episodes) return []
    return index.episodes
  }, [index])

  const years = useMemo(() => {
    const set = new Set<number>()
    for (const ep of episodes) {
      if (ep.year) set.add(ep.year)
    }
    return Array.from(set).sort((a, b) => b - a)
  }, [episodes])

  const filteredEpisodes = useMemo(() => {
    return episodes.filter((ep) => {
      if (selectedYear !== 'ALL' && String(ep.year) !== selectedYear) return false
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const text = `${ep.releaseTimeText} ${ep.episodeId} ${ep.year}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [episodes, selectedYear, searchQuery])

  // Pure pending view if no index is loaded
  if (!index && !isLoading && !error) {
    return (
      <div className="criterion-panel" aria-label="CPI & Event Timeline dock">
        <div className="criterion-head">
          <strong>CPI &amp; Event Timeline</strong>
          <span>Exploratory Macro Research</span>
        </div>

        <div className="criterion-empty" role="status">
          <p>{pendingNotice}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="criterion-panel" aria-label="CPI & Event Timeline dock">
      <div className="criterion-head">
        <strong>CPI &amp; Event Timeline</strong>
        <span>Exploratory Macro Research · 140 Episodes</span>
      </div>

      {isLoading && (
        <p className="criterion-loading" role="status">
          Loading audited CPI episodes index…
        </p>
      )}

      {error && (
        <div className="criterion-error-box" role="alert">
          <p className="criterion-error">{error}</p>
          {onRetry && (
            <button
              type="button"
              className="criterion-retry-btn"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {index && (
        <>
          <div className="criterion-controls">
            <div className="criterion-control-row">
              <label>
                Prior context
                <select
                  value={priorContextBars}
                  onChange={(event) =>
                    onPriorContextChange(Number(event.target.value) as PriorContextBars)
                  }
                >
                  <option value={0}>0 bars</option>
                  <option value={60}>60 bars</option>
                  <option value={120}>120 bars</option>
                  <option value={240}>240 bars (recommended)</option>
                </select>
              </label>
            </div>

            <div className="criterion-control-row">
              <label>
                Year filter
                <select
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
                >
                  <option value="ALL">All Years ({episodes.length})</option>
                  {years.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="criterion-control-row">
              <input
                type="text"
                className="criterion-search-input"
                placeholder="Search date (e.g. 2025.12)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Filter episodes by date"
              />
            </div>
          </div>

          <div className="criterion-list-header">
            <strong>Episodes</strong>
            <span>
              {filteredEpisodes.length} of {episodes.length} releases
            </span>
          </div>

          <div
            className="criterion-list"
            role="list"
            aria-label="140 CPI Timeline Episodes"
          >
            {filteredEpisodes.length === 0 && (
              <p className="criterion-empty">No episodes match the filter.</p>
            )}

            {filteredEpisodes.map((ep) => {
              const isSelected = selectedEpisodeId === ep.episodeId
              const isNoted = notedEpisodeIds.has(ep.episodeId)

              const hMm = ep.cpiSummary?.headline_mm
              const cMm = ep.cpiSummary?.core_mm

              const hDelta = hMm?.delta ? (hMm.delta.startsWith('-') ? hMm.delta : `+${hMm.delta}`) : '—'
              const cDelta = cMm?.delta ? (cMm.delta.startsWith('-') ? cMm.delta : `+${cMm.delta}`) : '—'

              return (
                <button
                  key={ep.episodeId}
                  type="button"
                  role="listitem"
                  className={`criterion-episode${isSelected ? ' selected' : ''}`}
                  onClick={() => onSelectEpisode(ep.episodeId)}
                  title={`Inspect CPI episode from ${ep.releaseTimeText}`}
                >
                  <span className="criterion-episode-top">
                    <b>{ep.releaseTimeText}</b>
                    <em>{ep.year}</em>
                  </span>

                  <span className="criterion-episode-result">
                    <span>
                      H m/m: <b>{hDelta}</b> ({hMm?.direction ?? '—'})
                    </span>
                    <span>
                      · C m/m: <b>{cDelta}</b> ({cMm?.direction ?? '—'})
                    </span>

                    {isNoted && (
                      <span
                        className="criterion-audited"
                        title="Personal audit note saved; not research approval"
                      >
                        Audited
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
