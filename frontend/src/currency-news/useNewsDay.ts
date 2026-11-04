import { useCallback, useEffect, useMemo, useState } from 'react'
import { validNewsFeed, validSavedNews, type NewsCurrency, type NewsFeed, type NewsVersion, type SavedNews } from './news-model'

type Choice = { date: string; story: string; currency: NewsCurrency; version: NewsVersion }
export function useNewsDay(date: string, today: boolean) {
  const [snapshot, setSnapshot] = useState<NewsFeed | null>(null)
  const [failure, setFailure] = useState<{ date: string; message: string } | null>(null)
  const [reload, setReload] = useState(0)
  const data = snapshot?.date === date ? snapshot : null
  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined, previous: NewsFeed | null = null
    async function pollNews() {
      try {
        const params = new URLSearchParams({ date }); if (previous) params.set('after_revision', previous.revision)
        const response = await fetch(`/storage-api/currency-news/feed?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Currency news unavailable (HTTP ${response.status}).`)
        const value = await response.json()
        if (controller.signal.aborted) return
        if (value?.unchanged === true) {
          if (value.schema !== 2 || value.date !== date || !previous || value.revision !== previous.revision) throw new Error('Invalid news feed response.')
        } else {
          if (!validNewsFeed(value, date)) throw new Error('Invalid news feed response.')
          const oldStories = new Map(previous?.stories.map(story => [story.id, story]) ?? [])
          const stories = value.stories.map(story => {
            const old = oldStories.get(story.id)
            return old && JSON.stringify(old) === JSON.stringify(story) ? old : story
          })
          if (!previous || previous.revision !== value.revision) setSnapshot({ ...value, stories })
          previous = { ...value, stories }
        }
        setFailure(null)
      } catch (error) {
        if (!controller.signal.aborted) setFailure({ date, message: error instanceof Error ? error.message : 'Currency news unavailable.' })
      }
      if (today && !controller.signal.aborted) timer = window.setTimeout(pollNews, 5000)
    }
    void pollNews()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [date, today, reload])

  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [versions, setVersions] = useState<Record<string, SavedNews>>({})
  const [versionFailures, setVersionFailures] = useState<Record<string, { date: string; message: string }>>({})
  const selected = useMemo(() => Object.values(choices).filter(c => c.date === date && data?.stories.some(s => s.id === c.story
    && s.implications.some(i => i.currency === c.currency && i.versions[0].run_id !== c.version.run_id && i.versions.some(v => v.run_id === c.version.run_id)))), [choices, data, date])
  const selectedKey = [...new Set(selected.map(c => c.version.run_id))].sort().join(':')
  useEffect(() => {
    const ids = selectedKey.split(':').filter(id => id && !versions[id])
    if (!ids.length) return
    const controller = new AbortController()
    async function load(id: string) {
      const response = await fetch(`/storage-api/currency-news/history/${id}`, { signal: controller.signal })
      if (!response.ok) throw new Error(`Saved assessment unavailable (HTTP ${response.status}).`)
      const value = await response.json()
      if (!validSavedNews(value, id) || selected.filter(c => c.version.run_id === id).some(c => {
        const row = value.rows.find(r => r.currency === c.currency)?.snapshot
        const item = row?.[c.version.collection][c.version.position]
        return !item || item.story_id && item.story_id !== c.story
      })) throw new Error('Invalid saved assessment response.')
      return value
    }
    void Promise.allSettled(ids.map(load)).then(results => {
      if (controller.signal.aborted) return
      if (results.some(r => r.status === 'fulfilled')) setVersions(old => {
        const next = { ...old }
        results.forEach((r, i) => { if (r.status === 'fulfilled') next[ids[i]] = r.value })
        while (Object.keys(next).length > 32) {
          const removable = Object.keys(next).find(id => !selectedKey.split(':').includes(id))
          if (!removable) break
          delete next[removable]
        }
        return next
      })
      setVersionFailures(old => {
        const next = { ...old }
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') delete next[ids[i]]
          else next[ids[i]] = { date, message: r.reason instanceof Error ? r.reason.message : 'Saved assessment unavailable.' }
        })
        return next
      })
    })
    return () => controller.abort()
  }, [date, selectedKey, selected, versions, reload])
  const stories = useMemo(() => (data?.stories ?? []).map(story => {
    const matches = selected.filter(c => c.story === story.id)
    if (!matches.length) return story
    return { ...story, implications: story.implications.map(implication => {
      const choice = matches.find(c => c.currency === implication.currency)
      if (!choice) return implication
      const saved = versions[choice.version.run_id]?.rows.find(r => r.currency === implication.currency)?.snapshot
      const item = saved?.[choice.version.collection][choice.version.position]
      if (!saved || !item) return { ...implication, pending: true, selected_run: choice.version.run_id }
      return { ...implication, legacy: !item.bias, bias: item.bias ?? ({ supportive: 'bullish', negative: 'bearish', mixed: 'conditional', no_clear_signal: 'neutral' } as const)[saved.implication],
        reason: item.reason || saved.reason, bullish_if: item.bullish_if ?? '', bearish_if: item.bearish_if ?? '',
        timing_note: item.timing_note, coverage_note: saved.coverage_note, selected_run: choice.version.run_id }
    }) }
  }), [data, selected, versions])
  const select = useCallback((story: string, currency: NewsCurrency, version: NewsVersion | null) => setChoices(old => {
    const next = { ...old }, key = `${story}:${currency}`
    if (!version) delete next[key]
    else next[key] = { date, story, currency, version }
    return next
  }), [date])
  return { data, stories, select,
    error: failure?.date === date ? failure.message : selected.map(c => versionFailures[c.version.run_id]).find(f => f?.date === date)?.message ?? null,
    reload: () => setReload(n => n + 1) }
}
