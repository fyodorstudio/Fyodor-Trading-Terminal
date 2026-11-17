import { useState, type KeyboardEvent } from 'react'
import { keywordTags, keywordLimit, keywordCharacters } from './keywords'

export function KeywordTags({ label, value, onChange, groups }: { label: string; value: string; onChange: (value: string) => void; groups?: Record<string, string[]> }) {
  const [draft, setDraft] = useState(''), [error, setError] = useState('')
  const [group, setGroup] = useState('All')
  const tags = keywordTags(value)
  const needle = draft.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
  const key = (term: string) => term.normalize('NFKC').toLowerCase()
  const grouped = new Map(Object.entries(groups ?? {}).map(([name, terms]) => [name, new Set(terms.map(key))]))
  const known = new Set([...grouped.values()].flatMap(terms => [...terms]))
  const inGroup = (tag: string, name: string) => name === 'All' || (name === 'Custom' ? !known.has(key(tag)) : grouped.get(name)?.has(key(tag)))
  // Typing always searches every group, including custom keywords, for duplicates.
  const visible = needle ? tags.filter(tag => tag.toLowerCase().includes(needle)) : tags.filter(tag => inGroup(tag, group))
  const duplicate = tags.some(tag => tag.toLowerCase() === needle)
  function add(text = draft) {
    const next = keywordTags([value, text].join(',')), serialized = next.join(', ')
    if (next.length > keywordLimit || serialized.length > keywordCharacters) { setError(`Use at most ${keywordLimit} tags and ${keywordCharacters} characters.`); return }
    onChange(serialized); setDraft(''); setError('')
  }
  function keydown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add() }
  }
  return <div className="news-keyword-editor" onBlur={event => {
    if (draft.trim() && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) add()
  }}><label>{label}<input aria-label={`${label} keyword input`} value={draft} placeholder="Type a word or phrase, then Enter" onChange={event => { setDraft(event.target.value); setError('') }} onKeyDown={keydown}
    onPaste={event => { const pasted = event.clipboardData.getData('text'); if (/[,\n]/.test(pasted)) { event.preventDefault(); add(draft + pasted) } }} /></label>
    <button type="button" onClick={() => add()} disabled={!draft.trim() || duplicate} aria-label={`Add ${label.toLowerCase()} keyword`}>{duplicate ? 'Already added' : 'Add tag'}</button>
    {needle && <small role="status">{duplicate ? 'This keyword already exists.' : `${visible.length} existing keywords match your typing.`} Press Enter or Add tag to save a new keyword.</small>}
    {groups && <div className="news-keyword-groups" role="group" aria-label={`${label} keyword groups`}>{['All', ...grouped.keys(), 'Custom'].map(name => <button type="button" key={name} aria-label={`${label} keywords: ${name}`} aria-pressed={!needle && group === name} onClick={() => { setGroup(name); setDraft('') }}>{name} <small>{tags.filter(tag => inGroup(tag, name)).length}</small></button>)}</div>}
    <div className="news-keyword-tags" aria-label={`${label} keywords`}>{visible.map(tag => <span key={tag.toLowerCase()} data-keyword-match={!!needle}>{tag}<button type="button" aria-label={`Remove ${label.toLowerCase()} keyword ${tag}`} onClick={() => { onChange(tags.filter(term => term !== tag).join(', ')); setError('') }}>×</button></span>)}</div>
    <small>{tags.length} / {keywordLimit} tags</small>
    {(error || tags.length > keywordLimit || value.length > keywordCharacters) && <p role="alert">{error || `Use at most ${keywordLimit} tags and ${keywordCharacters} characters.`}</p>}
  </div>
}
