import type { CalendarEvidenceSource, EconomicCalendarEvent } from '../contracts/calendar-event'

const publisherNames: Record<string, string> = {
  'ons.gov.uk': 'ONS', 'bls.gov': 'BLS', 'bfs.admin.ch': 'Swiss Federal Statistical Office',
  'destatis.de': 'Destatis', 'rba.gov.au': 'RBA', 'stats.govt.nz': 'Stats NZ', 'zew.de': 'ZEW',
  'federalreserve.gov': 'Federal Reserve', 'dol.gov': 'US Department of Labor', 'doleta.gov': 'US Department of Labor',
  'statistik.admin.ch': 'Swiss Federal Statistical Office', 'rbnz.govt.nz': 'RBNZ', 'ec.europa.eu': 'Eurostat',
  'bnz.co.nz': 'BNZ / BusinessNZ', 'nab.com.au': 'NAB', 'stat.go.jp': 'Statistics Bureau of Japan',
  'jil.go.jp': 'Japan Institute for Labour Policy and Training',
}

export function officialActualSource(event: EconomicCalendarEvent): CalendarEvidenceSource | undefined {
  if (event.calendar_sources?.actual) return event.calendar_sources.actual
  if (!event.actual_override_source) return undefined
  try {
    const url = new URL(event.actual_override_source)
    if (url.protocol !== 'https:') return undefined
    const name = Object.entries(publisherNames).find(([domain]) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))?.[1]
    return { name: name ?? url.hostname, url: url.href }
  } catch { return undefined }
}
