import { priceAlertSounds, type PriceAlertSoundId } from './price-alert-tones'

export function createPriceAlertSound() {
  let context: AudioContext | null = null
  let disposed = false
  let output: GainNode | null = null
  let volume = 30
  let active: (OscillatorNode | AudioBufferSourceNode)[] = []
  let customBuffer: AudioBuffer | null = null
  const unlockTimers = new Set<number>()
  const stop = () => {
    for (const node of active) { try { node.stop() } catch { /* Already ended. */ } }
    active = []
  }
  const unlock = async () => {
    if (disposed) return false
    try {
      if (context?.state === 'closed') { stop(); output?.disconnect(); output = null; context = null }
      context ??= new AudioContext()
      if (!output) { output = context.createGain(); output.connect(context.destination); output.gain.setValueAtTime(volume / 100, context.currentTime) }
      if (context.state !== 'running') {
        let timer = 0
        try { await Promise.race([context.resume(), new Promise<void>(resolve => { timer = window.setTimeout(resolve, 2000); unlockTimers.add(timer) })]) }
        finally { window.clearTimeout(timer); unlockTimers.delete(timer) }
      }
      return !disposed && context.state === 'running'
    } catch { return false }
  }
  return {
    unlock,
    setVolume(value: number) { volume = Math.max(0, Math.min(100, value)); if (context && output) output.gain.setValueAtTime(volume / 100, context.currentTime) },
    async decodeCustom(bytes: ArrayBuffer) {
      if (!context || disposed) throw new Error('Audio is unavailable. Try Preview to enable sound.')
      let buffer: AudioBuffer
      try { buffer = await context.decodeAudioData(bytes) }
      catch { throw new Error('Cannot read this audio file. Choose a playable MP3, WAV or OGG file.') }
      if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.duration > 60)
        throw new Error('Choose an audio clip no longer than 60 seconds.')
      return buffer
    },
    setCustomBuffer(buffer: AudioBuffer | null) { customBuffer = buffer },
    play(duration: number, soundId: PriceAlertSoundId = 'thin') {
      // The delivery queue requests bounded unlock/retry before scheduling audio.
      if (!context || context.state !== 'running' || disposed || volume === 0) return false
      try {
        stop()
        const start = context.currentTime
        if (soundId === 'custom') {
          if (!customBuffer) return false
          const source = context.createBufferSource()
          source.buffer = customBuffer
          source.loop = true
          source.connect(output!)
          active.push(source)
          source.start(start); source.stop(start + duration)
          source.onended = () => { source.disconnect(); active = active.filter(node => node !== source) }
          return true
        }
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
            oscillator.connect(gain); gain.connect(output!)
            active.push(oscillator)
            oscillator.start(at); oscillator.stop(end)
            oscillator.onended = () => {
              oscillator.disconnect(); gain.disconnect()
              active = active.filter(node => node !== oscillator)
            }
          }
        }
        return true
      } catch { stop(); return false }
    },
    stop,
    dispose() { disposed = true; for (const timer of unlockTimers) window.clearTimeout(timer); unlockTimers.clear(); stop(); customBuffer = null; void context?.close().catch(() => {}); output?.disconnect(); output = null; context = null },
  }
}
