import { useId, useState } from 'react'

export const marketWatchCollapsedKey = 'fyodor.market-watch.collapsed.v1'

function readCollapsed() {
  try { return localStorage.getItem(marketWatchCollapsedKey) === 'true' } catch { return false }
}

export function useMarketWatchDock() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const contentId = useId()
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(marketWatchCollapsedKey, String(next)) } catch { /* Retain the session preference. */ }
  }
  return { collapsed, contentId, toggle }
}

export type MarketWatchDock = ReturnType<typeof useMarketWatchDock>
