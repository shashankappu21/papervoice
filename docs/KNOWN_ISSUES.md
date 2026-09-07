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
