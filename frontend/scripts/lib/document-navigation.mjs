import fs from 'node:fs'
import path from 'node:path'

const withoutCode = markdown => markdown.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '')
const retiredDescriptions = [
  /Highlight\s*→\s*Scope\s*→\s*View/,
  /Alert has \*\*Highlight \/ MT5 Calendar \/ External Source\*\*/,
  /In Alert, choose \*\*Upcoming \/ Highlight\*\*/,
  /External Source view (?:inside|in) Alert/,
  /Alert['’]s \*\*Research\*\* button/,
  /The External Source view has Pin\/Pinned controls/,
]
export function staleFeatureDescriptions(markdown) {
  return retiredDescriptions.filter(pattern => pattern.test(withoutCode(markdown))).map(pattern => pattern.source)
}
function headingAnchors(markdown) {
  const seen = new Map()
  return [...withoutCode(markdown).matchAll(/^#{1,6}\s+(.+)$/gm)].map(([, heading]) => {
    const base = heading.toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replaceAll(' ', '-')
    const count = seen.get(base) ?? 0; seen.set(base, count + 1)
    return count ? `${base}-${count}` : base
  })
}
export function documentNavigation(filename) {
  const markdown = fs.readFileSync(filename, 'utf8'), problems = [], links = []
  for (const match of withoutCode(markdown).matchAll(/\[[^\]\n]*\]\((<[^>]+>|[^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').trim()
    if (/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(target)) continue
    let local, anchor
    try { [local, anchor] = target.split('#').map(part => decodeURIComponent(part)) }
    catch { problems.push(`malformed link ${target}`); continue }
    const destination = local ? path.resolve(path.dirname(filename), local) : filename
    links.push(target)
    if (!fs.existsSync(destination)) problems.push(`missing link ${target}`)
    else if (anchor && destination.endsWith('.md') && !headingAnchors(fs.readFileSync(destination, 'utf8')).includes(anchor)) problems.push(`missing heading ${target}`)
  }
  return { links, problems }
}
