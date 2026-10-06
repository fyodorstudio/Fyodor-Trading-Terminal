export type CalculationReply<T> = { id: number; result?: T; error?: string }
type WorkerPort = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>

// One active job and one replaceable pending job. Results from superseded input
// are discarded, so a broker/release change cannot display the old broker's bias.
export function latestCalculationClient<Input, Output>(worker: WorkerPort,
  receive: (reply: CalculationReply<Output>) => void) {
  let latest = 0, active = false, closed = false
  let pending: { id: number; input: Input } | null = null
  function dispatch() {
    if (closed || active || !pending) return
    const job = pending; pending = null; active = true
    worker.postMessage(job)
  }
  worker.onmessage = (event: MessageEvent<CalculationReply<Output>>) => {
    if (closed) return
    active = false
    if (event.data.id === latest) receive(event.data)
    dispatch()
  }
  const failed = () => {
    if (closed) return
    active = false; pending = null
    receive({ id: latest, error: 'Background calculation failed; reopen the scoring view to retry.' })
  }
  worker.onerror = failed; worker.onmessageerror = failed
  return {
    submit(input: Input) { latest++; pending = { id: latest, input }; dispatch(); return latest },
    close() { closed = true; pending = null; worker.terminate() },
  }
}
