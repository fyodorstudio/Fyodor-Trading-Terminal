import { memo, useState } from 'react'
import { readThesisCurrency, readThesisDay, readThesisMonth, thesisCurrencies, thesisDays, thesisMonths } from './thesis-model'
import { ThesisCurrencyTable } from './ThesisCurrencyTable'
import { useCurrencyResearch } from './useCurrencyResearch'
import { researchPrompt } from './research-prompt'
import { downloadResearchMarkdown } from './research-export'
import { LegacyResearchArchive } from './LegacyResearchArchive'
import './thesis.css'

export const ThesisDock = memo(function ThesisDock() {
  const [currency, setCurrency] = useState(readThesisCurrency)
  const [month, setMonth] = useState(readThesisMonth)
  const [day, setDay] = useState(() => readThesisDay(month))
  const selectedDate = `${month}-${String(day).padStart(2, '0')}`
  const [copyStatus, setCopyStatus] = useState('')
  const [archiveOpen, setArchiveOpen] = useState(false)
  const research = useCurrencyResearch(selectedDate, selectedDate, true)
  const context = `${currency}:${selectedDate}`
  const [copyContext, setCopyContext] = useState(context)
  const remember = (key: string, value: string) => {
    try { localStorage.setItem(`fyodor.thesis.${key}.v1`, value) } catch { /* Retain session choice. */ }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(researchPrompt(selectedDate, selectedDate, currency)); setCopyContext(context); setCopyStatus('Prompt copied') }
    catch { setCopyContext(context); setCopyStatus('Could not copy prompt. Allow clipboard access and retry.') }
  }
  return <section className="thesis-dock" aria-label="Thesis">
    <header className="thesis-header"><h2>Thesis</h2>
      <div className="thesis-currencies" role="group" aria-label="Thesis currency">
        {thesisCurrencies.map(item => <button key={item} type="button" aria-pressed={currency === item} onClick={() => {
          setCurrency(item); setCopyStatus(''); remember('currency', item)
        }}>{item}</button>)}
      </div>
      <label>Month <select aria-label="Thesis month" value={month} onChange={event => {
        const value = event.target.value
        setMonth(value); setDay(previous => Math.min(previous, thesisDays(value))); setCopyStatus(''); remember('month', value)
      }}>{thesisMonths.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>Day <select aria-label="Thesis day" value={day} onChange={event => {
        const value = Number(event.target.value); setDay(value); setCopyStatus(''); remember('day', String(value))
      }}>{Array.from({ length: thesisDays(month) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
      <span className="thesis-timezone">Jakarta · AM/PM</span>
      <button type="button" onClick={() => { void copy() }}>Copy research prompt</button>
      <button type="button" disabled={!research.data} onClick={() => {
        if (!research.data) return
        setCopyContext(context)
        try { downloadResearchMarkdown(research.data, research.error, currency); setCopyStatus('Markdown download requested') }
        catch { setCopyStatus('Could not export Markdown. Try again.') }
      }}>Export Markdown</button>
      <span className="thesis-copy-status" role="status">{copyContext === context ? copyStatus : ''}</span>
    </header>
    <div key={currency} className="thesis-scroll" tabIndex={0} aria-label={`${currency} fundamental research timeline`}>
      {research.error && <p className="thesis-notice" role="alert">{research.error}{research.data ? ' Showing last loaded assessments.' : ''}</p>}
      {research.data && <ThesisCurrencyTable data={research.data} currency={currency} />}
      <details className="thesis-details" open={archiveOpen} onToggle={event => setArchiveOpen(event.currentTarget.open)}>
        <summary>Earlier currency research</summary>{archiveOpen && <LegacyResearchArchive currency={currency} />}
      </details>
      {!research.data && !research.error && <p className="thesis-notice" role="status">Loading assessments…</p>}
    </div>
  </section>
})
