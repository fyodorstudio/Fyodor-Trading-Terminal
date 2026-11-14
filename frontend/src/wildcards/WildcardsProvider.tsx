import type { ReactNode } from 'react'
import { WildcardDialog } from './WildcardDialog'
import { useWildcardsState, WildcardsContext } from './useWildcards'
import './wildcards.css'

export function WildcardsProvider({ children }: { children: ReactNode }) {
  const state = useWildcardsState()
  return <WildcardsContext.Provider value={state}>{children}{state.editor && <WildcardDialog key={'items' in state.editor ? state.editor.date : state.editor.entry?.id ?? `${state.editor.at}:${state.editor.date}`} />}</WildcardsContext.Provider>
}
