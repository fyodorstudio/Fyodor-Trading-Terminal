import { encodeCustomAlertSound } from '../price-alerts/custom-alert-sound'

// Decode with the browser's existing codecs, then send bounded PCM WAV so the
// independent Windows worker needs neither a browser nor an extra audio package.
export async function alarmAudioUpload(file: File) {
  if (!/\.(mp3|wav|ogg)$/i.test(file.name) || !file.size || file.size > 2 * 1024 * 1024)
    throw new Error('Choose an MP3, WAV or OGG file up to 2 MB.')
  const context = new AudioContext()
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer())
    if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.duration > 60)
      throw new Error('Choose a playable clip up to 60 seconds.')
    const rate = 16000, count = Math.floor(buffer.duration * rate)
    const bytes = new ArrayBuffer(44 + count * 2), view = new DataView(bytes)
    const tag = (at: number, value: string) => [...value].forEach((c,i) => view.setUint8(at+i,c.charCodeAt(0)))
    tag(0,'RIFF'); view.setUint32(4,36+count*2,true); tag(8,'WAVE'); tag(12,'fmt ')
    view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true)
    view.setUint32(24,rate,true); view.setUint32(28,rate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true)
    tag(36,'data'); view.setUint32(40,count*2,true)
    const channels = Array.from({length:buffer.numberOfChannels},(_,i) => buffer.getChannelData(i))
    for (let i=0; i<count; i++) {
      const position=i*buffer.sampleRate/rate, start=Math.floor(position), fraction=position-start
      let sample=0
      for (const channel of channels) sample += (channel[start] ?? 0)*(1-fraction)+(channel[Math.min(start+1,channel.length-1)] ?? 0)*fraction
      view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,sample/channels.length))*32767),true)
    }
    return {name:file.name,data:encodeCustomAlertSound(bytes)}
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Cannot decode this audio file.')
  } finally { await context.close() }
}
