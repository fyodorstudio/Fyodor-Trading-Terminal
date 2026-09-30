import type { ResearchFamily, ResearchRule, ResearchSignal } from '../audit-data'
import { bundleComparisons, type BundleComparison, type BundleRule } from '../cpi-bundle-data'

const STORAGE_KEY = 'fyodor_criterion_audit_notes_v1'

export type AuditNote = {
  viewerSha256: string
  family: ResearchFamily | 'CPI_BUNDLE'
  signal: ResearchSignal | BundleComparison
  episodeId: string
  releaseText: string
  rule: ResearchRule | BundleRule
  text: string
  updatedAt: string
}

export function auditNoteKey(viewerSha256: string, family: AuditNote['family'], signal: AuditNote['signal'], episodeId: string) {
  return `${viewerSha256}|${family}|${signal}|${episodeId}`
}

export function readAuditNotes(): AuditNote[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is AuditNote =>
      item !== null && typeof item === 'object'
      && typeof item.viewerSha256 === 'string' && typeof item.episodeId === 'string'
      && typeof item.text === 'string' && typeof item.updatedAt === 'string'
      && typeof item.releaseText === 'string' && item.rule !== null && typeof item.rule === 'object'
      && (item.family === 'CPI' || item.family === 'NFP' || item.family === 'CPI_BUNDLE')
      && (item.family === 'CPI_BUNDLE' ? bundleComparisons.some(([id]) => id === item.signal)
          : item.signal === 'af' || item.signal === 'ap'),
    )
  } catch {
    return []
  }
}

export function writeAuditNotes(notes: AuditNote[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
    return true
  } catch {
    return false
  }
}

export function exportAuditNotesMarkdown(notes: AuditNote[]) {
  const ordered = [...notes].sort((a, b) => a.releaseText.localeCompare(b.releaseText) || a.family.localeCompare(b.family))
  const lines = [
    '# Criterion historical audit notes',
    '',
    'Personal chart observations, not registered setups or verified research outcomes.',
    'These notes were exported from browser-local storage. Keep this file to share them with Codex later.',
    '',
  ]
  for (const note of ordered) {
    lines.push(`## ${note.family} / EURUSD / ${note.releaseText} / ${note.signal.toUpperCase()}`,
      '',
      `- Episode ID: \`${note.episodeId}\``,
      `- Research viewer SHA-256: \`${note.viewerSha256}\``,
      `- Direction input: ${note.family === 'CPI_BUNDLE' ? `CPI bundle A-P / ${note.signal}` : note.signal === 'af' ? 'Actual - Forecast' : 'Actual - Previous'}`,
      `- Last viewed rule: ${note.rule.panel}; ${'cohort' in note.rule ? `${note.rule.cohort}; ` : ''}H${note.rule.horizon}; SL ${note.rule.stop} ATR; TP ${note.rule.target} ATR`,
      `- Updated: ${note.updatedAt}`, '', note.text, '')
  }
  return lines.join('\n')
}

export function downloadAuditNotes(notes: AuditNote[]) {
  const blob = new Blob([exportAuditNotesMarkdown(notes)], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'criterion-audit-notes.md'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
