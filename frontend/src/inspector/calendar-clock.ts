import { createContext, useContext } from 'react'

export const CalendarNowContext = createContext<number | null>(null)
export function useCountdownNow(fallback: number) { return useContext(CalendarNowContext) ?? fallback }
