# How Papervoice works

A tour of how a PDF becomes sound, and where each step lives. Read this before
changing anything; the individual files explain themselves from there.

---

## The shape of it

```
  a PDF
    │
    ▼
  extraction     pdf.js in a hidden WebView  ─────────► sentences on disk
    │
    ▼
  the reader     a list of sentences, one of them highlighted
    │
    ▼
  playback       decides what to speak next, and when
    │
    ▼
  TTS            text → speakable text → phonemes → audio → a file
    │
    ▼
  expo-audio     plays the file, and tells playback when it ended
```

Two things are worth holding onto, because most of the design follows from
them:

**Nothing leaves the phone.** pdf.js is vendored rather than fetched, voices are
downloaded once from named URLs and then only read locally, and there is no
analytics of any kind. When you are tempted to add a network call, that is the
thing being traded away.

**Synthesis is slower than reading.** A sentence takes a fraction of a second to
speak but has to be generated first, so the queue runs ahead of the listener and
caches. Most of `src/tts` exists because of that gap.

---

## Extraction — `src/extraction`

A PDF is parsed by **pdf.js running inside a WebView** that the user never sees.
It is there because pdf.js is a browser library and there is no sensible native
equivalent; `ExtractorWebView.tsx` is the bridge, and `extractorHtml.ts` is the
page it loads.

The document is copied next to that page and opened by name. It is emphatically
**not** passed across the bridge: an 80MB PDF as base64 inside an injected line
of JavaScript is several hundred megabytes of peak allocation against a heap
limit that is often 192MB, and it simply failed.

What comes back is positioned text items, which are then assembled:

| file | what it does |
| --- | --- |
| `blocks.ts` | groups text items into blocks by position |
| `lines.ts` | joins items into lines, and lines into paragraphs |
| `sentences.ts` | splits paragraphs into sentences, tagging headers and footers |
| `mainContent.ts` | finds where the front matter ends and the book begins |
| `sections.ts` | the contents page, from the PDF's own outline or from headings |

Sentences are written to a **file, not the database** — a book is tens of
thousands of them and SQLite is the wrong shape for that. The row in `books`
holds a path.

## Storage — `src/db`

SQLite through `expo-sqlite`. `schema.ts` holds numbered migrations; add one and
bump `SCHEMA_VERSION` rather than editing an existing block, or existing
installs will not get the change.

Books are identified by a **sha256 of the PDF**, not by their uri. A uri says
where a file was picked from, and both ways into the app mint a new one every
time, so the same document arriving twice used to make two books.

## Voices — `src/voices`

`catalog.ts` is the list, shipped inside the app so the voice list renders with
no network. Every entry names its files by absolute URL and carries its licence
and the page that licence was read from.

`voiceStore.ts` is the install logic, written against interfaces so it can be
tested without a filesystem; `deviceVoices.ts` is the thin part that really
touches the phone. A download lands on a `.part` file and is only given its real
name once the checksum agrees, so an interrupted download reads as "not
installed" rather than as a model that loads and produces noise.

`engine.ts` chooses between the neural engine and the phone's own voice.

Some models need ONNX metadata that their publisher does not ship — sherpa reads
`sample_rate` and friends out of the file itself and refuses one without them.
Rather than re-hosting a corrected copy, the catalogue carries the missing bytes
and the store appends them after downloading, before the checksum. That is why
`modelMetadata` exists.

## Speaking — `src/tts` and `modules/sherpa-tts`

| file | what it does |
| --- | --- |
| `speakable.ts` | what is actually said: numbers, abbreviations, stray punctuation |
| `chunk.ts` | splits a long sentence into pieces the engine handles well |
| `pauses.ts` | silence between sentences and paragraphs, so it is not a monotone |
| `synthQueue.ts` | runs ahead of the listener, so the next sentence is ready |
| `audioCache.ts` | keeps recent audio, since re-reading a page is normal |

`modules/sherpa-tts` is a local Expo module wrapping the sherpa-onnx AAR in
Kotlin. `modules/system-tts` wraps Android's own engine.

**eSpeak NG lives inside that AAR**, does the letters-to-sounds step, and is
GPLv3. That single fact determines this project's licence. Every Piper voice
here was trained on eSpeak's *British* output — including the ones named
`en_US` — so a replacement phonemiser must reproduce that exactly or the voices
degrade audibly. `npm run phonemes` exists to check such claims by measurement
rather than argument.

## Playback — `src/player`

`PlaybackProvider.tsx` holds the state that outlives any screen, so the mini
player keeps working while you browse the library. `usePlayback.ts` is the
machine: what is playing, what is next, what happens when audio ends.

`useSavedPosition.ts` writes the place back. That is treated as sacred — losing
someone's position in a ten-hour book is the worst thing this app could do.

`listeningTime.ts` estimates how long is left. It builds a running total once
per book, because the obvious version walked the whole book twice per spoken
sentence and made long books stutter.

## Screens — `app/` and `src/ui`

`expo-router`, file-based. `app/(tabs)` is the library, import and voices;
`app/reader/[bookId].tsx` is the reader.

The sentence list is a `FlatList` with a precomputed height index
(`src/ui/heightIndex.ts`), so jumping to sentence 8,000 does not require
measuring the 7,999 above it.

`src/tour` is the first-run walkthrough. It cuts a hole in a dimming layer
rather than drawing a highlight on top, so the control underneath stays
pressable — a tour you can use teaches more than one you watch.

---

## Tests

`npm test` — 268 of them, no device required. Pure logic is tested directly;
extraction has fixtures; the licence registry is enforced offline.

There is no component-testing setup, deliberately. What matters here is the
extraction, the text handling and the queue, and those are all testable without
rendering anything.

## Tools worth knowing

```sh
npm run audit:licences                  re-derive every voice's licence
npm run audit:licences -- check <model> judge a model before adopting it
npm run phonemes -- compare <a> <b>     do two models share a phonemiser?
npm run samples                         re-render the voice previews
npm run fixture                         capture an extraction fixture
npm run shots                           capture store screenshots, with buttons
npm run assets                          frame them for the Play listing
npm run site:assets                     rebuild what papervoice.app serves
```

The website lives in [`site/`](../site) and the early-access list behind it in
[`early-access/`](../early-access); each has its own README.

Each exists because a question kept coming back and being answered from memory,
usually wrongly.
