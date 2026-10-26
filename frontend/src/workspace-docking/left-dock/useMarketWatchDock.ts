import { useCallback, useId, useMemo, useState } from 'react'

export const marketWatchCollapsedKey = 'fyodor.market-watch.collapsed.v1'

function readCollapsed() {
  try { return localStorage.getItem(marketWatchCollapsedKey) === 'true' } catch { return false }
}

export function useMarketWatchDock() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const contentId = useId()
  const toggle = useCallback(() => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(marketWatchCollapsedKey, String(next)) } catch { /* Retain the session preference. */ }
  }, [collapsed])
  const open = useCallback(() => {
    setCollapsed(false)
    try { localStorage.setItem(marketWatchCollapsedKey, 'false') } catch { /* Retain the session preference. */ }
  }, [])
  return useMemo(() => ({ collapsed, contentId, toggle, open }), [collapsed, contentId, toggle, open])
}

export type MarketWatchDock = ReturnType<typeof useMarketWatchDock>
