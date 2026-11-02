"""Offline desktop sounds from the same preset catalogue as browser price alerts."""
import base64
from hashlib import sha256
import io
import json
import math
from pathlib import Path
import struct
import wave
from uuid import uuid4

PRESETS = json.loads((Path(__file__).resolve().parents[1] / 'config/alert-sounds.json').read_text(encoding='utf-8'))
DEFAULT_AUDIO = {'enabled': True, 'volume': 30, 'duration': 3, 'sound_id': 'thin', 'repeat': False}


def _write_audio(target, data):
    temporary = target.with_name(target.name + '.' + uuid4().hex + '.tmp')
    try:
        temporary.write_bytes(data)
        temporary.replace(target)
    finally:
        temporary.unlink(missing_ok=True)


def validate_audio(value):
    if not isinstance(value, dict) or set(value) != set(DEFAULT_AUDIO):
        raise ValueError('Invalid sound settings')
    if any(type(value[k]) is not bool for k in ('enabled', 'repeat')):
        raise ValueError('Invalid sound switch')
    if type(value['volume']) is not int or not 0 <= value['volume'] <= 100:
        raise ValueError('Volume must be 0–100')
    if type(value['duration']) is not int or value['duration'] not in (1, 3, 5, 10):
        raise ValueError('Sound duration must be 1, 3, 5 or 10 seconds')
    if value['sound_id'] not in [p['id'] for p in PRESETS] + ['custom']:
        raise ValueError('Unknown sound')


def custom_audio(directory, name, encoded):
    if not isinstance(name, str) or not name.strip() or len(name) > 200 or not isinstance(encoded, str):
        raise ValueError('Choose an audio file')
    try:
        data = base64.b64decode(encoded, validate=True)
        if not 0 < len(data) <= 2 * 1024 * 1024:
            raise ValueError('Audio must be at most 2 MB')
        with wave.open(io.BytesIO(data)) as wav:
            duration = wav.getnframes() / wav.getframerate()
            if wav.getsampwidth() != 2 or wav.getnchannels() != 1 or wav.getframerate() != 16000 or not 0 < duration <= 60:
                raise ValueError('Choose a playable clip up to 60 seconds')
            if len(wav.readframes(wav.getnframes())) != wav.getnframes() * 2:
                raise ValueError('Audio is truncated')
    except (wave.Error, EOFError, ZeroDivisionError) as error:
        raise ValueError('Invalid decoded audio') from error
    directory = Path(directory); directory.mkdir(parents=True, exist_ok=True)
    filename = 'custom-' + sha256(data).hexdigest() + '.wav'
    target = directory / filename
    if not target.exists():
        _write_audio(target, data)
    return {'file': filename, 'name': name.strip(), 'duration': duration}


def audio_path(directory, settings, custom=None):
    directory = Path(directory)
    if settings['sound_id'] == 'custom':
        if not custom:
            raise ValueError('Upload a custom sound first')
        target = (directory / custom['file']).resolve()
        if target.parent != directory.resolve() or not target.is_file():
            raise ValueError('Custom sound is missing; upload it again')
        return target
    preset = next(p for p in PRESETS if p['id'] == settings['sound_id'])
    identity = sha256(json.dumps(preset, sort_keys=True).encode()).hexdigest()[:16]
    target = directory / f"{preset['id']}-{settings['duration']}-{identity}.wav"
    if target.exists():
        return target.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    rate = 16000; samples = [0.] * (rate * settings['duration'])
    cycle = 0.
    while cycle < settings['duration']:
        for tone in preset['tones']:
            start = int((cycle + tone['offset']) * rate)
            end = min(len(samples), start + int(tone['duration'] * rate))
            for index in range(start, end):
                phase = ((index-start) * tone['frequency'] / rate) % 1
                value = (math.sin(2*math.pi*phase) if tone['waveform']=='sine' else
                    1 if tone['waveform']=='square' and phase < .5 else -1 if tone['waveform']=='square' else
                    1-4*abs(phase-.5) if tone['waveform']=='triangle' else 2*phase-1)
                envelope = min(1., (index-start)/160) * max(0., (end-index)/max(1,end-start))
                samples[index] += value * tone['volume'] * envelope
        cycle += preset['interval']
    output = io.BytesIO()
    with wave.open(output, 'wb') as wav:
        wav.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        wav.writeframes(b''.join(struct.pack('<h', int(max(-1,min(1,x))*32767)) for x in samples))
    _write_audio(target, output.getvalue())
    return target.resolve()
