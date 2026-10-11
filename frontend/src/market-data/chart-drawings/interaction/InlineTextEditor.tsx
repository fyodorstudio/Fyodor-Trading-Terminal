import { useEffect, useRef, useState } from 'react'
type InlineTextEditorProps = {
  initialText: string
  onCommit: (text: string) => void
  onCancel: () => void
}

export function InlineTextEditor({ initialText, onCommit, onCancel }: InlineTextEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const finishedRef = useRef(false)
  const [value, setValue] = useState(initialText)
  const commit = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    onCommit(value.trim())
  }

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [])

  return (
    <input
      ref={inputRef}
      className="drawing-text-input"
      aria-label="Drawing text"
      type="text"
      value={value}
      placeholder="Type text..."
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          finishedRef.current = true
          onCancel()
        }
        e.stopPropagation()
      }}
      onBlur={commit}
      onPointerDown={(e) => e.stopPropagation()}
    />
  )
}
