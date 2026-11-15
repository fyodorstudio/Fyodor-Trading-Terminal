import { useState, type KeyboardEvent } from 'react'
import { keywordTags, keywordLimit, keywordCharacters } from './keywords'

export function KeywordTags({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(''), [error, setError] = useState('')
  const tags = keywordTags(value)
  function add(text = draft) {
    const next = keywordTags([value, text].join(',')), serialized = next.join(', ')
    if (next.length > keywordLimit || serialized.length > keywordCharacters) { setError(`Use at most ${keywordLimit} tags and ${keywordCharacters} characters.`); return }
    onChange(serialized); setDraft(''); setError('')
  }
  function keydown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add() }
  }
  return <div className="news-keyword-editor"><label>{label}<input aria-label={`${label} keyword input`} value={draft} placeholder="Type a word or phrase, then Enter" onChange={event => setDraft(event.target.value)} onKeyDown={keydown}
    onPaste={event => { const pasted = event.clipboardData.getData('text'); if (/[,\n]/.test(pasted)) { event.preventDefault(); add(draft + pasted) } }} /></label>
    <button type="button" onClick={() => add()} disabled={!draft.trim()} aria-label={`Add ${label.toLowerCase()} keyword`}>Add tag</button>
    <div className="news-keyword-tags" aria-label={`${label} keywords`}>{tags.map(tag => <span key={tag.toLowerCase()}>{tag}<button type="button" aria-label={`Remove ${label.toLowerCase()} keyword ${tag}`} onClick={() => { onChange(tags.filter(term => term !== tag).join(', ')); setError('') }}>×</button></span>)}</div>
    <small>{tags.length} / {keywordLimit} tags</small>
    {(error || tags.length > keywordLimit || value.length > keywordCharacters) && <p role="alert">{error || `Use at most ${keywordLimit} tags and ${keywordCharacters} characters.`}</p>}
  </div>
}
