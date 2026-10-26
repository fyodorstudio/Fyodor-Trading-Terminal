// Original light chime inspired by the requested "Thin" sound. No remote audio.
export function createPriceAlertSound() {
  let context: AudioContext | null = null
  let disposed = false
  let active: OscillatorNode[] = []
  const stop = () => {
    for (const node of active) { try { node.stop() } catch { /* Already ended. */ } }
    active = []
  }
  const unlock = async () => {
    if (disposed) return false
    try {
      context ??= new AudioContext()
      if (context.state !== 'running') await context.resume()
      return !disposed && context.state === 'running'
    } catch { return false }
  }
  return {
    unlock,
    play(duration: number) {
      // Automatic triggers must not wait indefinitely for a browser gesture.
      // Unlock is requested explicitly by the drawing tool and sound controls.
      if (!context || context.state !== 'running' || disposed) return false
      stop()
      const start = context.currentTime
      for (let offset = 0; offset < duration; offset += 0.5) {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const at = start + offset
        const end = Math.min(start + duration, at + 0.4)
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(offset % 1 === 0 ? 1760 : 2093, at)
        gain.gain.setValueAtTime(0, at)
        gain.gain.linearRampToValueAtTime(0.12, at + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, end)
        oscillator.connect(gain); gain.connect(context.destination)
        oscillator.start(at); oscillator.stop(end)
        active.push(oscillator)
        oscillator.onended = () => {
          oscillator.disconnect(); gain.disconnect()
          active = active.filter(node => node !== oscillator)
        }
      }
      return true
    },
    stop,
    dispose() { disposed = true; stop(); void context?.close().catch(() => {}); context = null },
  }
}
