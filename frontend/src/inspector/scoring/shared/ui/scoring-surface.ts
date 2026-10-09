import { createContext } from 'react'

// The combined surface supports standalone scorer consumers and parity tests.
// Application entry points explicitly choose Inspector or Raycaster ownership.
export const ScoringSurface = createContext<'standalone' | 'context' | 'both'>('both')
