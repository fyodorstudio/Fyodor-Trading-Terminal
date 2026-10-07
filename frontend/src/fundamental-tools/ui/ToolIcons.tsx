import type { ReactNode } from 'react'
const icon = (children: ReactNode) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
export const RaycasterIcon = () => icon(<path d="M2 12h4l3-7 6 14 3-7h4" />)
// Lucide Candy / ChevronsUp; notices ship in public/third-party-notices.txt.
export const RoofsIcon = () => icon(<><path d="m17 11-5-5-5 5" /><path d="m17 18-5-5-5 5" /></>)
export const CandyIcon = () => icon(<>
  <path d="M10 7v10.9" /><path d="M14 6.1V17" />
  <path d="M16 7V3a1 1 0 0 1 1.707-.707 2.5 2.5 0 0 0 2.152.717 1 1 0 0 1 1.131 1.131 2.5 2.5 0 0 0 .717 2.152A1 1 0 0 1 21 8h-4" />
  <path d="M16.536 7.465a5 5 0 0 0-7.072 0l-2 2a5 5 0 0 0 0 7.07 5 5 0 0 0 7.072 0l2-2a5 5 0 0 0 0-7.07" />
  <path d="M8 17v4a1 1 0 0 1-1.707.707 2.5 2.5 0 0 0-2.152-.717 1 1 0 0 1-1.131-1.131 2.5 2.5 0 0 0-.717-2.152A1 1 0 0 1 3 16h4" />
</>)
export const ToolsGearIcon = () => icon(<><path d="m10 2-.6 3-2.3 1.4-2.9-1L2.2 9l2.3 2v2l-2.3 2 2 3.6 2.9-1L9.4 19l.6 3h4l.6-3 2.3-1.4 2.9 1 2-3.6-2.3-2v-2l2.3-2-2-3.6-2.9 1L14.6 5 14 2z" /><circle cx="12" cy="12" r="3" /></>)
