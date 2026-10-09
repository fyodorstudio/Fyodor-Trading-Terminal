import type { EconomicCalendarEvent } from '../../../../../../inspector/calendar-event'
import type { InspectorRelease } from '../../../../../../inspector/inspector-data'
import { ismSourceRelease } from '../../../../../../inspector/episodes/ism-episodes'
import { assessIsmMonthlyContext, type IsmSectorSettings } from '../assessment/ism-monthly-context'
import { resolveIsmV3 } from '../assessment/ism-score-v3'

export const ismSectors = ['manufacturing', 'services'] as const
export type IsmAnalysisInput = { release: InspectorRelease | null; events: readonly EconomicCalendarEvent[]; settings: IsmSectorSettings; asOf: number }
export function calculateIsmAnalysis({ release, events, settings, asOf }: IsmAnalysisInput) {
  const publications = release?.ismPublications, base = ismSourceRelease(release, null, asOf)
  const seed = base && base.releaseAt !== null && base.releaseAt <= asOf ? assessIsmMonthlyContext(base, events, settings) : null
  const snapshots = ismSectors.map((sector) => {
    const source = publications?.find((item) => item.familyId === `ism-${sector}`) ??
      (!publications && release?.familyId === `ism-${sector}` ? release : seed?.[sector].release) ?? null
    const assessment = source && (source.releaseAt === null || source.releaseAt <= asOf) ?
      source === base && seed ? seed : assessIsmMonthlyContext(source, events, settings) : null
    return { sector, source, assessment, member: assessment?.[sector] ?? null }
  })
  const latest = snapshots[1].assessment ?? snapshots[0].assessment
  return { snapshots, latest, resolution: resolveIsmV3(latest) }
}
export type IsmAnalysis = ReturnType<typeof calculateIsmAnalysis>
