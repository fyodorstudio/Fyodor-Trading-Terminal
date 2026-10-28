import { priceAlertSounds, type PriceAlertSoundId } from './price-alert-tones'

export function createPriceAlertSound() {
  let context: AudioContext | null = null
  let disposed = false
  let active: (OscillatorNode | AudioBufferSourceNode)[] = []
  let customBuffer: AudioBuffer | null = null
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
      // Automatic triggers must not wait indefinitely for a browser gesture.
      // Unlock is requested explicitly by the drawing tool and sound controls.
      if (!context || context.state !== 'running' || disposed) return false
      stop()
      const start = context.currentTime
      if (soundId === 'custom') {
        if (!customBuffer) return false
        const source = context.createBufferSource()
        source.buffer = customBuffer
        source.loop = true
        source.connect(context.destination)
        source.start(start); source.stop(start + duration)
        active.push(source)
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
    dispose() { disposed = true; stop(); customBuffer = null; void context?.close().catch(() => {}); context = null },
  }
}
