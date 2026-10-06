export type JobState<Result> = { result: Result | null; error: string | null; loading: boolean }
type Port = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>

// Equivalent consumers share one job. Completed results have a bounded LRU;
// abandoned pending jobs terminate, and failed jobs retry on a later mount.
export function sharedContextJobs<Input, Result>(calculate: (input: Input) => Result,
  createWorker: () => Port | null, capacity = 2) {
  const jobs = new Map<string, ReturnType<typeof createJob>>()
  function createJob(key: string, input: Input) {
    let state: JobState<Result> = { result: null, error: null, loading: true }
    let worker: Port | null = null, started = false, cancelled = false, generation = 0
    const listeners = new Set<() => void>()
    const finish = (result: Result | null, error: string | null, requestGeneration: number) => {
      if (cancelled || requestGeneration !== generation || !state.loading) return
      worker?.terminate(); worker = null
      state = { result, error, loading: false }
      for (const listener of listeners) listener()
      trim()
    }
    const start = () => {
      if (started) return
      started = true
      const requestGeneration = ++generation
      try {
        worker = createWorker()
        if (!worker) {
          void Promise.resolve().then(() => {
            if (cancelled || requestGeneration !== generation) return
            try { finish(calculate(input), null, requestGeneration) }
            catch (error) { finish(null, error instanceof Error ? error.message : 'Context calculation failed.', requestGeneration) }
          })
          return
        }
        worker.onmessage = (event: MessageEvent<{ id: number; result?: Result; error?: string }>) => {
          if (event.data.id !== 1) return
          finish(event.data.result ?? null, event.data.error ?? null, requestGeneration)
        }
        const fail = () => finish(null, 'Background calculation failed; reopen the view to retry.', requestGeneration)
        worker.onerror = fail; worker.onmessageerror = fail
        worker.postMessage({ id: 1, input })
      } catch { finish(null, 'Background context calculation could not start.', requestGeneration) }
    }
    const job = {
      snapshot: () => state,
      idle: () => listeners.size === 0,
      subscribe(listener: () => void) {
        if (cancelled) { cancelled = false; started = false; state = { result: null, error: null, loading: true }; jobs.set(key, job) }
        listeners.add(listener); start()
        return () => {
          listeners.delete(listener)
          void Promise.resolve().then(() => {
            if (!listeners.size && (state.loading || state.error)) {
              cancelled = true; generation++; worker?.terminate(); worker = null
              if (jobs.get(key) === job) jobs.delete(key)
            }
          })
          trim()
        }
      },
    }
    return job
  }
  function trim() {
    const idle = [...jobs].filter(([, job]) => job.idle() && !job.snapshot().loading)
    for (const [key] of idle.slice(0, Math.max(0, idle.length - capacity))) jobs.delete(key)
  }
  return {
    get(key: string, input: Input) {
      const existing = jobs.get(key)
      if (existing) { jobs.delete(key); jobs.set(key, existing); return existing }
      const job = createJob(key, input); jobs.set(key, job); trim(); return job
    },
  }
}
