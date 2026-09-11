"""
Renders one short sample of every voice, so a reader can hear one before
deciding to download 63MB of it.

    npm run samples

The samples are made here rather than on the phone, because a phone cannot
synthesise a voice it has not downloaded -- which is the entire problem. Each
is a few kilobytes of Opus, so all seventeen together are a rounding error
against the app's size.

Every voice says the same sentence on purpose. Comparing voices means holding
the words still; with different text each time you end up judging the sentence
rather than the speaker.

Needs `pip install sherpa-onnx` and ffmpeg on PATH. Models are cached under
scripts/.voices/ so a second run costs nothing, and both that and the models
are ignored by git -- only the finished samples are committed.
"""
import json
import os
import subprocess
import sys
import urllib.request
import wave

import sherpa_onnx

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(HERE, '.voices')
OUT = os.path.join(ROOT, 'assets', 'samples')
CATALOG = os.path.join(HERE, 'voices.json')

# The phonemiser data the app ships, reused rather than downloaded again.
ESPEAK = os.path.join(
    ROOT, 'modules', 'sherpa-tts', 'android', 'src', 'main', 'assets', 'espeak-ng-data'
)

# A comma for rhythm, a question for intonation, a number for how digits are
# read. Short enough to listen to seventeen times without resenting it.
SENTENCE = 'She paused, then asked: how far is it? About three miles.'

# Mono Opus. Speech at this bitrate is indistinguishable from the source for
# the purpose of choosing a voice, and it is a twentieth of the size.
BITRATE = '24k'


# A 63MB model over a domestic connection drops often enough that giving up on
# the first failure means running this by hand until it happens to work.
ATTEMPTS = 4


def fetch(url: str, path: str) -> None:
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)

    # Written beside the real name first, so an interrupted download is never
    # mistaken for a finished one on the next run.
    partial = path + '.part'

    for attempt in range(1, ATTEMPTS + 1):
        try:
            print(
                f'    downloading {os.path.basename(path)}'
                + (f' (attempt {attempt})' if attempt > 1 else ''),
                flush=True,
            )
            urllib.request.urlretrieve(url, partial)
            os.replace(partial, path)
            return
        except Exception as cause:
            if os.path.exists(partial):
                os.remove(partial)
            if attempt == ATTEMPTS:
                raise
            print(f'    {cause}; retrying', flush=True)


def tts_for(voice: dict) -> sherpa_onnx.OfflineTts:
    folder = os.path.join(CACHE, voice['id'].replace('/', '_'))
    model = os.path.join(folder, 'model.onnx')
    tokens = os.path.join(folder, 'tokens.txt')

    fetch(voice['model'], model)
    fetch(voice['tokens'], tokens)

    if voice['family'] == 'kitten':
        embeddings = os.path.join(folder, 'voices.bin')
        fetch(voice['voices'], embeddings)
        model_config = sherpa_onnx.OfflineTtsModelConfig(
            kitten=sherpa_onnx.OfflineTtsKittenModelConfig(
                model=model, voices=embeddings, tokens=tokens, data_dir=ESPEAK
            ),
            num_threads=2,
        )
    else:
        model_config = sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=model, tokens=tokens, data_dir=ESPEAK
            ),
            num_threads=2,
        )

    return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=model_config))


def write_wav(path: str, samples, rate: int) -> None:
    with wave.open(path, 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(b''.join(
            int(max(-1.0, min(1.0, value)) * 32767).to_bytes(2, 'little', signed=True)
            for value in samples
        ))


def main() -> int:
    if not os.path.isdir(ESPEAK):
        print(f'espeak data missing at {ESPEAK}. Run: npm run setup:espeak')
        return 1

    with open(CATALOG, encoding='utf-8') as f:
        voices = json.load(f)

    os.makedirs(OUT, exist_ok=True)
    made = 0

    for voice in voices:
        target = os.path.join(OUT, f"{voice['id']}.opus")
        if os.path.exists(target):
            print(f"  {voice['name']}: already made")
            continue

        print(f"  {voice['name']} ({voice['id']})", flush=True)
        try:
            tts = tts_for(voice)
            audio = tts.generate(SENTENCE, sid=voice['speakerId'], speed=voice['rate'])
        except Exception as cause:
            # One voice that will not load should not stop the other sixteen.
            print(f'    failed: {cause}')
            continue

        raw = target.replace('.opus', '.wav')
        write_wav(raw, audio.samples, audio.sample_rate)

        subprocess.run(
            ['ffmpeg', '-y', '-loglevel', 'error', '-i', raw,
             '-c:a', 'libopus', '-b:a', BITRATE, '-ac', '1', target],
            check=True,
        )
        os.remove(raw)

        size = os.path.getsize(target) / 1024
        print(f'    {size:.0f} KB')
        made += 1

    total = sum(
        os.path.getsize(os.path.join(OUT, name)) for name in os.listdir(OUT)
    ) / 1024
    print(f'\n{made} made, {total:.0f} KB of samples in total')
    return 0


if __name__ == '__main__':
    sys.exit(main())
