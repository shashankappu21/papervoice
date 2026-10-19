"""How loud each voice's sample speaks, and evening them out.

    python scripts/voiceLevels.py           report every sample's speech level
    python scripts/voiceLevels.py --check   fail if any is off the target
    python scripts/voiceLevels.py --level   re-encode the ones that are off

Measured 2026-10-19: the phone's Google voices all speak at about -17 dBFS,
while the natural voices spoke at -18 to -26 -- Cori about half as loud as a
phone voice. The app now boosts each natural voice by a fixed amount when it
synthesises (`gainDb` in src/voices/catalog.ts, worked out from these samples
before they were levelled), and the samples are levelled here so the play
buttons in the Voices tab compare like with like.

"Speech level" is the RMS of the 30 ms frames louder than a tenth of the
loudest one, in dBFS: the speaking, not the silence around it. Levelling
re-encodes with `alimiter` so a boosted peak cannot clip. Running it twice
changes nothing: a sample within TOLERANCE_DB of the target is left alone.

Needs ffmpeg on PATH, numpy and scipy. Run after makeVoiceSamples.py, which
writes samples at the models' own level.
"""
import pathlib
import subprocess
import sys
import tempfile

import numpy as np
from scipy.io import wavfile

SAMPLES = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'samples'
TARGET_DB = -17.0
TOLERANCE_DB = 0.75
BITRATE = '24k'  # as makeVoiceSamples.py


def decode(path: pathlib.Path) -> np.ndarray:
    with tempfile.TemporaryDirectory() as tmp:
        wav = pathlib.Path(tmp) / 'x.wav'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(path), '-ac', '1', '-ar', '24000', str(wav)],
                       check=True)
        rate, data = wavfile.read(wav)
    return data.astype(np.float64) / 32768.0, rate


def speech_level(x: np.ndarray, rate: int) -> float:
    frame = int(0.03 * rate)
    rms = np.array([np.sqrt(np.mean(x[i:i + frame] ** 2)) for i in range(0, len(x) - frame, frame)])
    speech = rms[rms > 0.1 * rms.max()]
    return float(20 * np.log10(np.sqrt(np.mean(speech ** 2))))


def level(path: pathlib.Path, gain_db: float) -> None:
    out = path.with_suffix('.levelled.opus')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(path),
                    '-af', f'volume={gain_db:.2f}dB,alimiter=limit=0.95:level=false',
                    '-c:a', 'libopus', '-b:a', BITRATE, '-ac', '1', str(out)], check=True)
    out.replace(path)


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    off = 0
    for path in sorted(SAMPLES.glob('*.opus')):
        x, rate = decode(path)
        db = speech_level(x, rate)
        gain = TARGET_DB - db
        mark = ''
        if abs(gain) > TOLERANCE_DB:
            off += 1
            mark = f'  {gain:+.1f} dB to target'
            if mode == '--level':
                level(path, gain)
                x, rate = decode(path)
                mark += f' -> now {speech_level(x, rate):.1f}'
        print(f'{path.stem:24} {db:6.1f} dBFS{mark}')
    if mode == '--check' and off:
        print(f'\n{off} sample(s) off the {TARGET_DB} dBFS target. Run with --level.')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
