export type DrawingToolId =
  | 'trend-line'
  | 'rectangle'
  | 'horizontal-line'
  | 'parallel-channel'
  | 'path'
  | 'arrow'
  | 'text'
  | 'long-position'
  | 'short-position'
  | 'circle'
  | 'price-note'
  | 'vertical-line'
  | 'fib-retracement'
  | 'date-price-range'

export type DrawingToolDefinition = {
  id: DrawingToolId
  label: string
  icon: string
  gesture: 'point' | 'drag' | 'path'
}

export const drawingTools: DrawingToolDefinition[] = [
  { id: 'trend-line', label: 'Trend line', icon: '╱', gesture: 'drag' },
  { id: 'rectangle', label: 'Rectangle', icon: '▭', gesture: 'drag' },
  { id: 'horizontal-line', label: 'Horizontal line', icon: '—', gesture: 'point' },
  { id: 'parallel-channel', label: 'Parallel channel', icon: '≋', gesture: 'drag' },
  { id: 'path', label: 'Path', icon: '⌁', gesture: 'path' },
  { id: 'arrow', label: 'Arrow', icon: '↗', gesture: 'drag' },
  { id: 'text', label: 'Text', icon: 'T', gesture: 'point' },
  { id: 'long-position', label: 'Long position', icon: 'L', gesture: 'drag' },
  { id: 'short-position', label: 'Short position', icon: 'S', gesture: 'drag' },
  { id: 'circle', label: 'Circle', icon: '○', gesture: 'drag' },
  { id: 'price-note', label: 'Price note', icon: '$', gesture: 'drag' },
  { id: 'vertical-line', label: 'Vertical line', icon: '│', gesture: 'point' },
  { id: 'fib-retracement', label: 'Fib retracement', icon: 'F', gesture: 'drag' },
  { id: 'date-price-range', label: 'Date and price range', icon: '↔', gesture: 'drag' },
]
