import { priceAlertSounds, type PriceAlertSoundId } from './price-alert-tones'

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
    play(duration: number, soundId: PriceAlertSoundId = 'thin') {
      // Automatic triggers must not wait indefinitely for a browser gesture.
      // Unlock is requested explicitly by the drawing tool and sound controls.
      if (!context || context.state !== 'running' || disposed) return false
      stop()
      const start = context.currentTime
      const preset = priceAlertSounds.find(sound => sound.id === soundId) ?? priceAlertSounds[0]
      for (let cycle = 0; cycle < duration; cycle += preset.interval) {
        for (const tone of preset.tones) {
          const offset = cycle + tone.offset
          if (offset >= duration) continue
          const oscillator = context.createOscillator()
          const gain = context.createGain()
          const at = start + offset
          const end = Math.min(start + duration, at + tone.duration)
          oscillator.type = tone.waveform
          oscillator.frequency.setValueAtTime(tone.frequency, at)
          gain.gain.setValueAtTime(0, at)
          gain.gain.linearRampToValueAtTime(tone.volume, Math.min(at + 0.01, end))
          gain.gain.exponentialRampToValueAtTime(0.001, end)
          oscillator.connect(gain); gain.connect(context.destination)
          oscillator.start(at); oscillator.stop(end)
          active.push(oscillator)
          oscillator.onended = () => {
            oscillator.disconnect(); gain.disconnect()
            active = active.filter(node => node !== oscillator)
          }
        }
      }
      return true
    },
    stop,
    dispose() { disposed = true; stop(); void context?.close().catch(() => {}); context = null },
  }
}
