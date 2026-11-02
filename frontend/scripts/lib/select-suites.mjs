// The full suite remains the default. Explicit filters still run sequentially.
export function selectSuites(suites, filters) {
  const requested=filters.filter(value=>value!=='--')
  if(!requested.length)return suites
  for(const filter of requested)if(!suites.some(suite=>suite.toLowerCase().includes(filter.toLowerCase())))
    throw new Error(`No frontend suite matches '${filter}'. Use a filename fragment from tests/suites.mjs.`)
  return suites.filter(suite=>requested.some(filter=>suite.toLowerCase().includes(filter.toLowerCase())))
}
