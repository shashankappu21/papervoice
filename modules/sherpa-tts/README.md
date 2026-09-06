# sherpa-tts

A local Expo module wrapping [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)
so a Piper voice can turn one sentence into a WAV file on the device. Android
only, and everything happens offline: no text ever leaves the phone.

## Setting it up from a clean clone

```bash
npm run setup:tts     # fetches the prebuilt AAR into android/libs/
npm run push:voice    # downloads a voice and adb-pushes it into app storage
```

The AAR is 49MB and is deliberately **not committed** — a binary that size in
git history is permanent, and the GitHub release it comes from is immutable, so
fetching is reproducible. `npm run setup:tts` is idempotent.

## Why the build file looks the way it does

- **`noCompress` for `onnx` and `bin` is mandatory.** `aapt` compresses assets by
  default, which misaligns the ONNX model and makes onnxruntime fail on read.
- **`abiFilters 'arm64-v8a'` is a development-only setting.** It roughly halves
  native build time on the target phone. Add `armeabi-v7a` before the first store
  release: the app ships as an AAB and Play generates per-ABI splits, so a 32-bit
  ABI costs arm64 users nothing in download size.
- **`versionCode` and `versionName` are required** by `expo-module-gradle-plugin`,
  which reads them for publication metadata. The build fails at configuration
  time without them.

## Voices

Voices are never bundled in the app. During development they are `adb push`ed
into the app's files dir so the edit-compile loop never waits on a download; in
release they are downloaded on demand and work fully offline once present.

The default is `en_US-ljspeech-medium`: single speaker, 22.05kHz, trained from
scratch on the public-domain LJ Speech dataset (verified in its MODEL_CARD).

## API

```ts
import { SherpaTts } from '../modules/sherpa-tts';

await SherpaTts.load(modelPath, tokensPath, espeakDataDir, numThreads);
const { path, durationSec, rtf } = await SherpaTts.synthesize(text, sid, speed, outPath);
await SherpaTts.unload();
```

All paths are plain filesystem paths, not `file://` URIs: sherpa-onnx opens them
itself. `rtf` below 1 means synthesis outruns playback, which is what makes
reading ahead of the listener possible.
