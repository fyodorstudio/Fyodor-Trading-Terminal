import { useCallback, useEffect, useMemo, useState } from 'react'
import { validNewsDay, validSavedNews, type NewsCurrency, type NewsDay, type NewsDayRow, type SavedNews } from './news-model'

export function useNewsDay(date: string, today: boolean) {
  const [snapshot, setSnapshot] = useState<NewsDay | null>(null)
  const [failure, setFailure] = useState<{ date: string; message: string } | null>(null)
  const [reload, setReload] = useState(0)
  const data = snapshot?.date === date ? snapshot : null
  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined, previous: NewsDay | null = null
    async function pollNews() {
      try {
        const params = new URLSearchParams({ date }); if (previous) params.set('after_revision', previous.revision)
        const response = await fetch(`/storage-api/currency-news/day?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Currency news unavailable (HTTP ${response.status}).`)
        const value = await response.json()
        if (controller.signal.aborted) return
        if (value?.unchanged === true) {
          if (value.schema !== 1 || value.date !== date || !previous || value.revision !== previous.revision) throw new Error('Invalid daily news response.')
        } else {
          if (!validNewsDay(value, date)) throw new Error('Invalid daily news response.')
          const oldRows = new Map(previous?.rows.map(row => [row.currency, row]) ?? [])
          const rows = value.rows.map(row => {
            const old = oldRows.get(row.currency)
            return old && JSON.stringify(old) === JSON.stringify(row) ? old : row
          })
          if (!previous || previous.revision !== value.revision) setSnapshot({ ...value, rows })
          previous = { ...value, rows }
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

  const [choices, setChoices] = useState<Partial<Record<NewsCurrency, { date: string; id: string }>>>({})
  const [versions, setVersions] = useState<Record<string, SavedNews>>({})
  const [versionFailures, setVersionFailures] = useState<Record<string, { date: string; message: string }>>({})
  const selected = useMemo(() => (data?.rows ?? []).flatMap(row => {
    const choice = choices[row.currency]
    return choice?.date === date && choice.id !== row.refreshes[0]?.run_id && row.refreshes.some(r => r.run_id === choice.id) ? [choice.id] : []
  }), [data, choices, date])
  const selectedKey = [...new Set(selected)].sort().join(':')
  useEffect(() => {
    const ids = selectedKey.split(':').filter(id => id && !versions[id])
    if (!ids.length) return
    const controller = new AbortController()
    async function load(id: string) {
      const response = await fetch(`/storage-api/currency-news/history/${id}`, { signal: controller.signal })
      if (!response.ok) throw new Error(`Saved refresh unavailable (HTTP ${response.status}).`)
      const value = await response.json()
      if (!validSavedNews(value, id) || new Date(Date.parse(value.saved_at) + 7 * 3600000).toISOString().slice(0, 10) !== date
        || data?.rows.some(row => row.refreshes.some(r => r.run_id === id) && !value.rows.some(r => r.currency === row.currency && r.snapshot?.run_id === id))) throw new Error('Invalid saved refresh response.')
      return value
    }
    void Promise.allSettled(ids.map(load)).then(results => {
      if (controller.signal.aborted) return
      if (results.some(r => r.status === 'fulfilled')) setVersions(old => {
        const next = { ...old }
        results.forEach((r, i) => { if (r.status === 'fulfilled') next[ids[i]] = r.value })
        while (Object.keys(next).length > 32) delete next[Object.keys(next).find(id => !selectedKey.includes(id))!]
        return next
      })
      setVersionFailures(old => {
        const next = { ...old }
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') delete next[ids[i]]
          else next[ids[i]] = { date, message: r.reason instanceof Error ? r.reason.message : 'Saved refresh unavailable.' }
        })
        return next
      })
    })
    return () => controller.abort()
  }, [date, selectedKey, data, versions, reload])
  const rows = useMemo<NewsDayRow[]>(() => (data?.rows ?? []).map(row => {
    const choice = choices[row.currency]
    if (choice?.date !== date || choice.id === row.refreshes[0]?.run_id || !row.refreshes.some(r => r.run_id === choice.id)) return row
    const saved = versions[choice.id]?.rows.find(r => r.currency === row.currency)?.snapshot ?? null
    return { ...row, snapshot: saved, pending: !saved }
  }), [data, choices, date, versions])
  const select = useCallback((currency: NewsCurrency, id: string) => setChoices(old => {
    const next = { ...old }
    if (!id) delete next[currency]
    else next[currency] = { date, id }
    return next
  }), [date])
  return { data, rows, select,
    error: failure?.date === date ? failure.message : selected.map(id => versionFailures[id]).find(f => f?.date === date)?.message ?? null,
    reload: () => setReload(n => n + 1) }
}
