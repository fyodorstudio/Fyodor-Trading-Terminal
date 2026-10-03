import assert from 'node:assert/strict'

export async function testPriorityFilters({ viteServer, container, getView, act, openFamilies, menuButton }) {
  const { priorityCategories, mostRelevantFamilies, upgradeFamilySelections } =
    await viteServer.ssrLoadModule('./src/criterion/timeline/timeline-priority-categories.ts')
  const { curatedFamilyForBlock } = await viteServer.ssrLoadModule('./src/criterion/timeline/timeline-event-families.ts')
  assert.deepEqual(priorityCategories.USD.map((category) => category.id), ['policy', 'inflation', 'labor', 'growth'])
  assert.deepEqual(priorityCategories.EUR.map((category) => category.id), ['policy', 'inflation', 'growth', 'labor'])
  assert.ok(!mostRelevantFamilies.includes('claims') && !mostRelevantFamilies.includes('fed-minutes') &&
    !mostRelevantFamilies.includes('ecb-accounts'), 'Supporting releases are outside the default shortlist')
  const block = (eventId, countryCode, currency) => ({ countryCode, currency, rows: [{ eventId }] })
  assert.equal(curatedFamilyForBlock(block('276010023', 'DE', 'EUR')), 'german-inflation')
  assert.equal(curatedFamilyForBlock(block('250500003', 'FR', 'EUR')), 'french-pmi')
  assert.equal(curatedFamilyForBlock(block('999030023', 'EU', 'EUR')), 'euro-wages')
  assert.equal(curatedFamilyForBlock(block('840050008', 'US', 'USD')), undefined,
    'Governor Powell remarks are not reclassified as Chair remarks')
  assert.equal(curatedFamilyForBlock(block('840280002', 'US', 'USD')), undefined,
    'Median CPI is not the headline/core CPI release')
  assert.equal(curatedFamilyForBlock(block('276010023', 'FR', 'EUR')), undefined)
  const nationalKey = `source:${JSON.stringify(['DE', 'EUR', 'CPI'])}`
  assert.deepEqual(upgradeFamilySelections(['fomc', 'ecb', nationalKey], true),
    ['fomc', 'fed-minutes', 'ecb', 'ecb-accounts', 'german-inflation'])
  const legacyUsCpi = `source:${JSON.stringify(['US', 'USD', 'CPI'])}`
  assert.deepEqual(upgradeFamilySelections([legacyUsCpi], true), ['us-cpi', legacyUsCpi],
    'An explicit old generic CPI choice retains its supporting Median CPI coverage')

  let menu = await openFamilies()
  const control = (label) => menu.querySelector(`[aria-label="${label}"]`)
  const mode = () => control('Show releases')
  const close = async () => act(async () => control('Close event filters').click())
  async function choose(value) {
    await act(async () => { mode().value = value; mode().dispatchEvent(new window.Event('change', { bubbles: true })) })
  }
  assert.equal(mode().value, 'relevant', 'Fresh profiles open with Most relevant')
  assert.equal(menu.querySelectorAll('[data-priority-category]').length, 8, 'Only four main categories per currency')
  assert.ok([...menu.querySelectorAll('.timeline-more-families, .timeline-category-customize')].every((node) => !node.open),
    'Supporting families and detailed customization start collapsed')
  assert.deepEqual([...menu.querySelector('[aria-label="EUR families"]').querySelectorAll('[data-priority-category]')]
    .map((node) => node.dataset.priorityCategory), ['policy', 'inflation', 'growth', 'labor'])
  await act(async () => control('EUR Inflation').click())
  assert.ok(!control('German CPI / HICP').checked && !control('Euro-area inflation').checked)
  assert.ok(control('USD Inflation').checked, 'EUR category editing leaves USD independent')
  assert.equal(mode().value, 'selected')
  assert.deepEqual(getView().watchlist, mostRelevantFamilies, 'Category edits remain drafts until Apply')
  await act(async () => menuButton(menu, 'Apply').click())
  assert.ok(!getView().groups.some((group) => ['german-inflation', 'euro-inflation'].includes(group.familyId)))
  assert.ok(getView().watchlist.includes('us-cpi') && getView().watchlist.includes('pce'))

  menu = await openFamilies()
  await choose('relevant')
  await act(async () => control('US PPI').click())
  assert.equal(control('USD Inflation').indeterminate, true, 'Partial family selections use a mixed category checkbox')
  await choose('all')
  await choose('selected')
  assert.equal(control('US PPI').checked, false, 'Exploring All releases keeps the custom draft')
  await choose('relevant')
  assert.equal(control('US PPI').checked, true, 'Most relevant explicitly restores the approved families')
  await close()
  assert.ok(!getView().watchlist.includes('german-inflation'), 'Dismissal discards preset changes too')
  menu = await openFamilies()
  await choose('relevant')
  await act(async () => menuButton(menu, 'Apply').click())
  assert.deepEqual(getView().watchlist, mostRelevantFamilies)
  assert.equal(container.querySelectorAll('.timeline-anchor-page tbody tr').length, 6,
    'Category filtering preserves the selected CPI readings and sums')
  console.log('  ✓ EURUSD priority order, source identities, category drafts, mixed selections and preset restoration')
}
