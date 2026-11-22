import type { EditingHandle } from './drawing-overlay-contract'
import type { ChartDrawingPoint } from '../chart-drawing-record'
import type { drawingCoordinates } from '../drawing-coordinates'
import { isHorizontalDrawingTool } from '../drawing-tool'

export function shiftEditedDrawingPoints(editing: EditingHandle, point: ChartDrawingPoint,
  coordinates: ReturnType<typeof drawingCoordinates>, currentLogical: number | null): ChartDrawingPoint[] | null {
  if (!editing.startPoint || !editing.initialPoints) return null
  const deltaPrice = point.price - editing.startPoint.price
  if (isHorizontalDrawingTool(editing.tool)) {
    return editing.initialPoints.map(item => ({ ...item, price: item.price + deltaPrice }))
  }
  const deltaTime = point.time - editing.startPoint.time

  if (currentLogical !== null && editing.startLogical !== undefined && editing.initialLogicals) {
    const deltaLogical = currentLogical - editing.startLogical
    return editing.initialPoints.map((p, idx) => {
      const initLogical = editing.initialLogicals?.[idx]
      let newTime = (p.time + deltaTime) as ChartDrawingPoint['time']
      if (initLogical !== null && initLogical !== undefined) {
        newTime = coordinates.logicalToTime(initLogical + deltaLogical) ?? newTime
      }
      return {
        time: newTime,
        price: editing.tool === 'vertical-line' ? p.price : p.price + deltaPrice,
      }
    })
  }

  return editing.initialPoints.map((p) => ({
    time: (p.time + deltaTime) as ChartDrawingPoint['time'],
    price: editing.tool === 'vertical-line' ? p.price : p.price + deltaPrice,
  }))
}
