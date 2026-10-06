import assert from 'node:assert/strict'

// Coverage/sensitivity diagnostics only. No prices or search over optimal parameters.
export function auditInteractions({ timeline, priorTimeline, publications, contextAt, resolvePolicy, guards, priority }) {
  const rows = publications.filter(r => r.releaseAt !== null && r.chartTime !== null).flatMap(release => {
    const result = contextAt(timeline, release.chartTime * 1000)?.result
    const prior = contextAt(priorTimeline, release.chartTime * 1000)?.result
    if (!result || !prior) return []
    if (result.policy.mode === 'balanced') {
      // JSON archives normalize -0 to 0; both represent exact cancellation.
      assert.equal(result.total === 0 ? 0 : result.total, prior.total === 0 ? 0 : prior.total, 'Inactive interaction must preserve base score')
      assert.equal(result.direction, prior.direction, 'Inactive interaction must preserve base bias')
    }
    return [{ date: new Date(release.releaseAt).toISOString().slice(0, 10), family: release.familyId,
      releaseAt: release.releaseAt, chartAt: release.chartTime * 1000, baseDirection: prior.direction,
      direction: result.direction, strength: result.strength, total: result.total,
      mode: result.policy.mode, changed: result.direction !== prior.direction, result }]
  })
  const summarize = items => ({ publications: items.length, laborPriority: items.filter(r => r.mode === 'labor-priority').length,
    directionChanges: items.filter(r => r.changed).length })
  const variants = [
    ['Default', guards], ['Monthly guards 0.25%', { ...guards, monthlyCore: .25, threeMonthCore: .25 }],
    ['Monthly guards 0.35%', { ...guards, monthlyCore: .35, threeMonthCore: .35 }],
    ['Annual guard 3.25%', { ...guards, annualCore: 3.25 }], ['Annual guard 3.75%', { ...guards, annualCore: 3.75 }],
  ]
  const sensitivity = variants.map(([name, limits]) => {
    let laborPriority = 0, directionChanges = 0
    const cases = {}
    for (const row of rows) {
      const policy = resolvePolicy(row.result.members, limits)
      const active = row.result.members.filter(m => m.status === 'active')
      const total = active.length ? Math.round(active.reduce((sum, m) => sum + m.total * policy.weights[m.family] / 100, 0) * 1e12) / 1e12 : null
      const direction = total === null ? 'uncomputed' : total > 0 ? 'stronger' : total < 0 ? 'weaker' :
        priority.map(f => active.find(m => m.family === f)).find(Boolean)?.usdDirection ?? 'uncomputed'
      laborPriority += policy.mode === 'labor-priority' ? 1 : 0
      directionChanges += direction !== row.baseDirection ? 1 : 0
      if (row.family === 'us-cpi' && ['2025-08-12', '2025-09-11'].includes(row.date)) cases[row.date] = direction
    }
    return { name, guards: limits, laborPriority, directionChanges, cases }
  })
  const outside = rows.filter(r => r.mode === 'labor-priority' && r.date < '2025')
  const replayDates = outside.length ? [...new Set([outside[0], outside[Math.floor(outside.length / 2)], outside.at(-1)].map(r => r.date))] : []
  return { summary: summarize(rows), periods: { '2015–2024': summarize(rows.filter(r => r.date < '2025')),
    '2025–2026': summarize(rows.filter(r => r.date >= '2025')) }, sensitivity, replayDates,
    changes: rows.filter(r => r.changed).map(({ result, ...row }) => ({ ...row, explanation: result.explanation,
      policy: result.policy, sources: result.members.map(m => ({ family: m.family, total: m.total,
        contribution: m.contribution, status: m.status, traits: m.traits })) })) }
}

export function interactionAuditMarkdown(audit) {
  return ['', '## Interaction coverage and sensitivity', '',
    'Prototype rule, frozen before replay. Counts describe changed interpretations, not price accuracy. CPI/NFP standalone votes are unchanged.', '',
    '| Period | Publications | Labor priority | Changed direction vs v3 |', '| --- | ---: | ---: | ---: |',
    ...Object.entries(audit.periods).map(([period, stats]) => `| ${period} | ${stats.publications} | ${stats.laborPriority} | ${stats.directionChanges} |`), '',
    '| Guard variant | Labor priority | Changed direction | Aug 12 2025 USD | Sep 11 2025 USD |', '| --- | ---: | ---: | --- | --- |',
    ...audit.sensitivity.map(r => `| ${r.name} | ${r.laborPriority} | ${r.directionChanges} | ${r.cases['2025-08-12']} | ${r.cases['2025-09-11']} |`), '',
    'The two user cases motivated this prototype; defaults were declared before broader replay. Sensitivity variants are disclosed, not optimized against price outcomes. Future-removal replay cannot undo later provider revisions.', '']
}
