import { useId, useState } from 'react'

/** Input editing is explicit; contribution tables remain read-only. */
export function ScoringInputSettings({ currency, inputs }: {
  currency: 'USD' | 'EUR'; inputs: readonly { id: string; label: string; enabled: boolean; onToggle: () => void }[]
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return <div className="scoring-input-settings">
    <button type="button" aria-label={`Advanced ${currency} input settings`} aria-expanded={open}
      aria-controls={id} onClick={() => setOpen(value => !value)}>Advanced settings · {currency} inputs</button>
    {open && <section id={id} aria-label={`Advanced ${currency} inputs`} className="scoring-input-settings-panel">
      <p>Shared with Raycaster. Disabled weights are not redistributed.</p>
      <ul>{inputs.map(input => <li key={input.id}><span>{input.label}</span>
        <button type="button" aria-label={`Use ${input.label}`} aria-pressed={input.enabled} onClick={input.onToggle}>
          {input.enabled ? 'Enabled' : 'Off'}
        </button></li>)}</ul>
    </section>}
  </div>
}
