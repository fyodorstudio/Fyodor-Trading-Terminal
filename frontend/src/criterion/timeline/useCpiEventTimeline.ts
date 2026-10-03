import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ResearchChartArrow } from '../../trader-notebook/chart-levels/PlannedTradePriceLines'
import {
  deriveChartLevels,
  fetchTimelineEpisode,
  fetchTimelineIndex,
  fetchTimelineTradeLevels,
  findRowTradeLevels,
  timelineManifest,
  type CpiTimelineEpisodePayload,
  type CpiTimelineIndex,
  type EvaluatedTradeLevel,
  type TimelineChartLevels,
} from './cpi-event-timeline-data'
import type {
  TimelineReleaseBlock,
  TimelineSeriesRow,
} from './CpiEventTimelineTable'
import {
  writeAuditNotes,
  type AuditNote,
} from '../arrow-result/audit-notes'

export type UseCpiEventTimelineOptions = {
  enabled: boolean
  auditNotes: AuditNote[]
  onSaveAuditNotes?: (notes: AuditNote[]) => boolean
}

export type UseCpiEventTimelineReturn = {
  timelineIndex: CpiTimelineIndex | null
  timelineIndexLoading: boolean
  timelineIndexError: string | null
  handleRetryTimelineIndex: () => void

  selectedTimelineEpisodeId: string | null
  selectTimelineEpisode: (episodeId: string) => void
  clearTimelineSelection: () => void

  timelineEpisodePayload: CpiTimelineEpisodePayload | null
  timelineEpisodeLoading: boolean
  timelineEpisodeError: string | null
  handleRetryTimelineEpisode: () => void

  timelineTradeLevels: Record<string, EvaluatedTradeLevel> | null
  selectedTimelineRowKey: string | null
  handleSelectTimelineRow: (
    block: TimelineReleaseBlock,
    row: TimelineSeriesRow,
    key: string
  ) => void
  selectedTimelineLevels: TimelineChartLevels | null

  saveTimelineNote: (text: string) => boolean
  currentTimelineNote: AuditNote | null
  currentTimelineNotes: AuditNote[]
  timelineArrows: ResearchChartArrow[]
  timelineLevels: {
    label?: string
    entry: number
    stop: number
    target: number
    direction: 1 | -1
  } | null
}

export function useCpiEventTimeline({
  enabled,
  auditNotes,
  onSaveAuditNotes,
}: UseCpiEventTimelineOptions): UseCpiEventTimelineReturn {
  const [timelineIndex, setTimelineIndex] = useState<CpiTimelineIndex | null>(null)
  const [timelineIndexLoading, setTimelineIndexLoading] = useState(false)
  const [timelineIndexError, setTimelineIndexError] = useState<string | null>(null)
  const [timelineIndexRetryToken, setTimelineIndexRetryToken] = useState(0)

  const [selectedTimelineEpisodeId, setSelectedTimelineEpisodeId] = useState<string | null>(null)
  const [timelineEpisodePayload, setTimelineEpisodePayload] = useState<CpiTimelineEpisodePayload | null>(null)
  const [timelineEpisodeLoading, setTimelineEpisodeLoading] = useState(false)
  const [timelineEpisodeError, setTimelineEpisodeError] = useState<string | null>(null)
  const [timelineEpisodeRetryToken, setTimelineEpisodeRetryToken] = useState(0)

  const [timelineTradeLevels, setTimelineTradeLevels] = useState<Record<string, EvaluatedTradeLevel> | null>(null)
  const [selectedTimelineRowKey, setSelectedTimelineRowKey] = useState<string | null>(null)
  const [selectedTimelineLevels, setSelectedTimelineLevels] = useState<TimelineChartLevels | null>(null)
  const [cpiArrowLevels, setCpiArrowLevels] = useState<TimelineChartLevels | null>(null)

  const handleRetryTimelineIndex = useCallback(() => {
    setTimelineIndexError(null)
    setTimelineIndexRetryToken((count) => count + 1)
  }, [])

  const handleRetryTimelineEpisode = useCallback(() => {
    setTimelineEpisodeError(null)
    setTimelineEpisodeRetryToken((count) => count + 1)
  }, [])

  const selectTimelineEpisode = useCallback((episodeId: string) => {
    setSelectedTimelineEpisodeId(episodeId)
    setTimelineEpisodeRetryToken((count) => count + 1)
    // Clear previous episode payload, selected row and levels immediately when switching
    setTimelineEpisodePayload(null)
    setSelectedTimelineRowKey(null)
    setSelectedTimelineLevels(null)
    setTimelineEpisodeError(null)
    setTimelineEpisodeLoading(true)
  }, [])

  const clearTimelineSelection = useCallback(() => {
    setSelectedTimelineEpisodeId(null)
    setTimelineEpisodePayload(null)
    setSelectedTimelineRowKey(null)
    setSelectedTimelineLevels(null)
    setTimelineEpisodeError(null)
    setTimelineEpisodeLoading(false)
  }, [])

  const handleSelectTimelineRow = useCallback(
    (block: TimelineReleaseBlock, row: TimelineSeriesRow, key: string) => {
      setSelectedTimelineRowKey(key)
      if (!selectedTimelineEpisodeId) return
      const lev = findRowTradeLevels(timelineTradeLevels, selectedTimelineEpisodeId, block, row)
      const derived = deriveChartLevels(lev, block.entryTimestamp)
      setSelectedTimelineLevels(derived ? { ...derived, label: `${block.family} · ${row.series}` } : null)
      if (block.id === timelineEpisodePayload?.cpiBlock.id) setCpiArrowLevels(derived)
    },
    [selectedTimelineEpisodeId, timelineTradeLevels, timelineEpisodePayload]
  )

  const currentTimelineNotes = useMemo(() => {
    return auditNotes.filter((note) => note.family === 'CPI_TIMELINE' &&
      note.viewerSha256 === timelineManifest.reviewedSourceManifestSha256)
  }, [auditNotes])

  const currentTimelineNote = useMemo(() => {
    if (!selectedTimelineEpisodeId) return null
    return (
      currentTimelineNotes.find((note) => note.episodeId === selectedTimelineEpisodeId) ??
      null
    )
  }, [selectedTimelineEpisodeId, currentTimelineNotes])

  const saveTimelineNote = useCallback(
    (text: string): boolean => {
      if (
        !selectedTimelineEpisodeId ||
        !timelineEpisodePayload ||
        timelineEpisodePayload.episodeId !== selectedTimelineEpisodeId
      ) {
        return false
      }
      const releaseText = timelineEpisodePayload.releaseTimeText ?? 'Historical Release'
      const updated: AuditNote = {
        viewerSha256: timelineManifest.reviewedSourceManifestSha256,
        family: 'CPI_TIMELINE',
        signal: 'H240',
        episodeId: selectedTimelineEpisodeId,
        releaseText,
        rule: { horizon: 240, stop: 1, target: 1 },
        text,
        updatedAt: new Date().toISOString(),
      }
      const nextNotes = [
        ...auditNotes.filter(
          (n) => !(n.family === 'CPI_TIMELINE' && n.episodeId === selectedTimelineEpisodeId &&
            n.viewerSha256 === timelineManifest.reviewedSourceManifestSha256)
        ),
        updated,
      ]
      if (onSaveAuditNotes) {
        return onSaveAuditNotes(nextNotes)
      }
      return writeAuditNotes(nextNotes)
    },
    [selectedTimelineEpisodeId, timelineEpisodePayload, auditNotes, onSaveAuditNotes]
  )

  // 1. Timeline Index & Trade Levels Effect
  useEffect(() => {
    if (!enabled) return
    if (timelineIndex && timelineTradeLevels) return
    if (timelineIndexError) return

    let cancelled = false
    const controller = new AbortController()

    queueMicrotask(() => {
      if (!cancelled && !controller.signal.aborted) {
        setTimelineIndexLoading(true)
      }
    })

    Promise.all([
      fetchTimelineIndex(controller.signal),
      fetchTimelineTradeLevels(controller.signal),
    ])
      .then(([idx, levels]) => {
        if (cancelled || controller.signal.aborted) return
        setTimelineIndex(idx)
        setTimelineTradeLevels(levels)
        setTimelineIndexLoading(false)
        setTimelineIndexError(null)
      })
      .catch((err: unknown) => {
        if (cancelled || controller.signal.aborted) return
        setTimelineIndexError(err instanceof Error ? err.message : 'Failed to load timeline index')
        setTimelineIndexLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
      setTimelineIndexLoading(false)
    }
  }, [
    enabled,
    timelineIndex,
    timelineTradeLevels,
    timelineIndexError,
    timelineIndexRetryToken,
  ])

  // 2. Timeline Episode Payload Effect
  useEffect(() => {
    if (!selectedTimelineEpisodeId || !enabled) {
      queueMicrotask(() => {
        setTimelineEpisodePayload(null)
        setSelectedTimelineRowKey(null)
        setSelectedTimelineLevels(null)
        setTimelineEpisodeLoading(false)
        setTimelineEpisodeError(null)
      })
      return
    }

    if (timelineEpisodeError) {
      return
    }

    let cancelled = false
    const controller = new AbortController()
    const targetEpisodeId = selectedTimelineEpisodeId

    queueMicrotask(() => {
      if (!cancelled && !controller.signal.aborted) {
        setTimelineEpisodePayload(null)
        setSelectedTimelineRowKey(null)
        setSelectedTimelineLevels(null)
        setTimelineEpisodeError(null)
        setTimelineEpisodeLoading(true)
      }
    })

    fetchTimelineEpisode(targetEpisodeId, controller.signal)
      .then((payload) => {
        if (
          cancelled ||
          controller.signal.aborted ||
          targetEpisodeId !== selectedTimelineEpisodeId
        ) {
          return
        }
        if (payload.episodeId !== targetEpisodeId) {
          throw new Error('Episode payload identity does not match the requested release')
        }

        setTimelineEpisodePayload(payload)
        setTimelineEpisodeLoading(false)
        setTimelineEpisodeError(null)

        const firstRow = payload.cpiBlock?.rows?.[0]
        if (firstRow) {
          const key = `${payload.cpiBlock.id}:${firstRow.series}:0`
          setSelectedTimelineRowKey(key)
          const lev = findRowTradeLevels(
            timelineTradeLevels,
            payload.episodeId,
            payload.cpiBlock,
            firstRow
          )
          const derived = deriveChartLevels(lev, payload.cpiBlock.entryTimestamp)
          setSelectedTimelineLevels(derived ? { ...derived, label: `${payload.cpiBlock.family} · ${firstRow.series}` } : null)
          setCpiArrowLevels(derived)
        } else {
          setSelectedTimelineRowKey(null)
          setSelectedTimelineLevels(null)
          setCpiArrowLevels(null)
        }
      })
      .catch((err: unknown) => {
        if (
          cancelled ||
          controller.signal.aborted ||
          targetEpisodeId !== selectedTimelineEpisodeId
        ) {
          return
        }
        setTimelineEpisodeError(
          err instanceof Error ? err.message : 'Failed to load episode payload'
        )
        setTimelineEpisodeLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
      setTimelineEpisodeLoading(false)
    }
  }, [
    selectedTimelineEpisodeId,
    enabled,
    timelineTradeLevels,
    timelineEpisodeError,
    timelineEpisodeRetryToken,
  ])

  const timelineLevels = useMemo(() => {
    if (!selectedTimelineLevels) return null
    return {
      label: selectedTimelineLevels.label,
      entry: selectedTimelineLevels.entryPrice,
      stop: selectedTimelineLevels.stopPrice,
      target: selectedTimelineLevels.targetPrice,
      direction: (selectedTimelineLevels.direction === 'Long' ? 1 : -1) as 1 | -1,
    }
  }, [selectedTimelineLevels])

  const timelineArrows = useMemo((): ResearchChartArrow[] => {
    if (!timelineEpisodePayload) return []
    // Inspecting another event's levels must not move the CPI arrow to that event.
    const levels = cpiArrowLevels
    if (!levels) return []
    return [
      {
        id: `timeline:${timelineEpisodePayload.episodeId}`,
        time: levels.entryTimestamp,
        entryPrice: levels.entryPrice,
        direction: levels.direction === 'Long' ? 'long' : 'short',
      },
    ]
  }, [timelineEpisodePayload, cpiArrowLevels])

  return {
    timelineIndex,
    timelineIndexLoading,
    timelineIndexError,
    handleRetryTimelineIndex,

    selectedTimelineEpisodeId,
    selectTimelineEpisode,
    clearTimelineSelection,

    timelineEpisodePayload,
    timelineEpisodeLoading,
    timelineEpisodeError,
    handleRetryTimelineEpisode,

    timelineTradeLevels,
    selectedTimelineRowKey,
    handleSelectTimelineRow,
    selectedTimelineLevels,

    saveTimelineNote,
    currentTimelineNote,
    currentTimelineNotes,
    timelineArrows,
    timelineLevels,
  }
}
