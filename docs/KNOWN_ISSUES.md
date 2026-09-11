# Known issues

Things found, understood well enough to describe, and deliberately not fixed
yet. Each one is written to be pasted into a GitHub issue when the code is
pushed, so it says what was observed and what was ruled out -- not just a title.

## A hum at the end of short sentences (Kitten voices)

**What is heard.** Some sentences end with a short "humm" or "hee" after the
words have finished. It happens with the Kitten nano voices and mostly on short
sentences.

**What the waveform shows.** A 50ms amplitude envelope, as a percentage of each
file's own peak, from utterances the app had cached:

```
s135  100 76 34 36 17  3 | 44 30 | 2 1 1
s23   100 87 76 41 10  0 |  6  7  6 3 | 0 0 0
s61   100 79 70 42 27  9  5  1 1 0 0 0     <- unaffected, for comparison
```

The sound falls to near-silence and then a separate burst appears. In s135 the
burst (44%) is louder than the decay that precedes it (3%). It is not a decay
tail, which is what the unaffected files show.

**Why the current trim does not remove it.** `trimTail` in `SherpaTtsModule.kt`
walks backwards from the end while samples are below a threshold. The burst is
above that threshold, so the walk stops at the burst and leaves it in place.
Raising the threshold does not help: it would then cut through the ends of
words, which was tried at 0.3 and produced an audible click.

**What was tried and set aside.** Detecting the burst by shape instead of level
-- scan back for ~80ms of continuous quiet within the last 0.75s, and cut there
if everything after it stays under 60% of peak. It is plausible but was not
confidently correct, and each attempt costs a full native rebuild plus listening
to real sentences to judge. Left open rather than guessed at.

**Where it comes from.** The model. The same sound is audible in KittenML's own
demos on their site, faintly. So it is not introduced by joining the pieces of
an utterance, by the trim, or by anything else this app does -- which means
there is no bug here to fix, only an artifact to mitigate. Anything done about
it is a workaround, and should be written as one.

**Why it is worse here than in their demos.** Not established. Three candidates,
cheapest first:

- The app uses `model.fp16.onnx`. If the demos run the fp32 model, halving the
  precision is the obvious suspect, and swapping the file is a download rather
  than a code change.
- The app asks for `defaultRate: 1.15`, because the voices read slowly. Rate in
  sherpa changes the duration predictor, so it does not merely resample the
  output -- it can lengthen or emphasise whatever is in the tail.
- A phone speaker is not a laptop speaker. A low hum that a laptop barely
  reproduces can sit right in the range a small driver is loudest in.

Worth an experiment in that order: synthesise the same short sentences at fp16
and fp32, and at rate 1.0 and 1.15, and compare the envelope of the tail. That
is four files and no rebuild.

## The Kitten voices are fed the wrong phoneme alphabet

**What is heard.** Jasper, Bruno, Luna, Hugo, Rosie and Kiki mispronounce
particular sounds -- the *j* in "judge", the *ch* in "church", r-coloured
vowels as in "brother". Short sentences suffer most, having less context to
hide it. The Piper voices and the phone's own voices are unaffected.

**What was measured.** Every voice's `tokens.txt` was compared against
Lyra's, which works:

```
en_US-kristin-medium   identical to Lyra
en_US-norman-medium    identical to Lyra
en_GB-cori-medium      identical to Lyra
en_US-john-medium      identical to Lyra
kitten-nano-*          24 of Lyra's symbols missing, 42 extra
```

The extra symbols are the giveaway: `ʤ ʧ ɝ ʱ ʴ ʷ ˠ ¡ « » ¿ → ↗ ↘` and the
whole uppercase alphabet. eSpeak cannot emit any of them. They belong to
**misaki**, the G2P that KittenTTS and Kokoro were trained with, which writes
`ʤ` where eSpeak writes `dʒ`, `ʧ` for `tʃ`, and `ɝ` for `ɚ`.

The model's own metadata says `has_espeak: 1, voice: en-us`, so sherpa
phonemises it with eSpeak regardless. When eSpeak emits `dʒ`, sherpa looks up
`d` (id 46) and `ʒ` (id 147) separately -- two tokens where the model was
trained on one, `ʤ` (id 82). That id is never reached at all.

This is the same failure that had Kokoro removed, which is unsurprising: same
G2P family. It should have been recognised when Kitten was added.

**Why it cannot be fixed here.** sherpa takes text, not phonemes, and eSpeak
runs inside the native library where the phoneme stream is not exposed. The
request for phoneme input -- k2-fsa/sherpa-onnx#2260 -- has been open since May
2025 with no maintainer reply. The documented workaround, a `lexicon.txt`
instead of eSpeak, does not apply either: `OfflineTtsKittenModelConfig` has
only `model, tokens, data_dir, voices, length_scale`, with no lexicon field.

**The Piper voices are a separate question.** Kristin, Norman, John and Cori
share Lyra's token map byte for byte and phonemise identically, so nothing is
asking them for the wrong sounds. Where they sound worse it is the acoustic
model: LibriVox recordings of 11 to 15 hours against LJSpeech's 24 studio
hours.

## Building the synthesis pipeline rather than using sherpa's

Recorded because the question keeps arising, and because the answer ties three
separate problems together.

The models are a thinner interface than sherpa suggests. Read from the ONNX
files directly:

```
Piper    input, input_lengths, scales, sid  ->  output
Kitten   tokens, style                      ->  output
```

Phoneme ids, three floats, a speaker index. `onnxruntime-react-native` is
published by Microsoft under MIT, and onnxruntime is already shipped inside
sherpa's AAR -- 21MB of its 30. Token mapping is a text file already
downloaded, and WAV writing already exists in the native module. Everything
except grapheme-to-phoneme is mechanical.

**G2P is the whole difficulty, and it is simultaneously three problems:** the
mispronunciation above, the GPLv3 that eSpeak forces on the app, and the
largest single file in the APK. One piece of work would answer all three.

**The design, when it is done, is two G2Ps and not one.** The phoneme alphabet
belongs to the model rather than to the app, so a pipeline with a single
phonemiser is deciding globally something that is true per voice. The catalog
already carries `family`, but the right key is an explicit `phonemeSet:
'espeak' | 'misaki'` -- a model of Piper's architecture could be trained on
either, so the two are not the same question.

- eSpeak-trained voices (every Piper one) need eSpeak's exact output,
  including its schwa reduction, flapping and contextual stress. Approximating
  it degrades voices that currently work.
- misaki-trained voices (Kitten, Kokoro) need misaki, which is already ported
  to Rust, Swift and Python -- a port to reach Android, not a reinvention.

**Not now.** sherpa-onnx 2.0.0 is being built to drop eSpeak and expose a
token-input hook: the same two pieces. Doing it ourselves means owning a
phonemiser for ever; waiting means plugging a port into someone else's hook.
Worth revisiting if 2.0.0 stalls for months.
