export type PriceAlertSoundId = 'thin' | 'bell' | 'double-beep' | 'digital' | 'soft-chime'
  | 'pulse' | 'triple-beep' | 'doorbell' | 'rising-chime' | 'falling-chime' | 'sonar' | 'buzzer' | 'custom'

type Tone = { offset: number; duration: number; frequency: number; waveform: OscillatorType; volume: number }
type AlertSound = { id: PriceAlertSoundId; label: string; interval: number; tones: Tone[] }

// Shared with the independent desktop alarm worker.
import presets from '../../../config/alert-sounds.json'
export const priceAlertSounds = presets as AlertSound[]
