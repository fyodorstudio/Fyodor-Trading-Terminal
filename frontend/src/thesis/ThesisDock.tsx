import { memo, useCallback, useState } from 'react'
import { readThesisCurrency, readThesisDay, readThesisMonth, thesisCurrencies } from './thesis-model'
import { AlertDateSelector } from '../alert/dock/AlertDateSelector'
import { ThesisCurrencyTable } from './ThesisCurrencyTable'
import { useCurrencyResearch } from './useCurrencyResearch'
import { researchPrompt } from './research-prompt'
import { downloadResearchMarkdown } from './research-export'
import { LegacyResearchArchive } from './LegacyResearchArchive'
import './thesis.css'

export const ThesisDock = memo(function ThesisDock() {
  const [currency, setCurrency] = useState(readThesisCurrency)
  const [selectedDate, setDate] = useState(() => {
    const month = readThesisMonth()
    return `${month}-${String(readThesisDay(month)).padStart(2, '0')}`
  })
  const [copyStatus, setCopyStatus] = useState('')
  const changeDate = useCallback((date: string) => {
    setDate(date); setCopyStatus('')
    try {
      localStorage.setItem('fyodor.thesis.month.v1', date.slice(0, 7))
      localStorage.setItem('fyodor.thesis.day.v1', String(Number(date.slice(8))))
    } catch { /* Retain session choice. */ }
  }, [])
  const [archiveOpen, setArchiveOpen] = useState(false)
  const research = useCurrencyResearch(selectedDate, selectedDate, true, currency)
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
      <AlertDateSelector date={selectedDate} onChange={changeDate} label="Thesis" />
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
