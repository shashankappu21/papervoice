# Papervoice

Turns the PDFs you own into audiobooks. Entirely on your phone — no account, no
subscription, and nothing you read is ever uploaded.

Import a PDF, press play, and follow along as each sentence is highlighted. The
voices are neural text-to-speech running on the device itself, so it works with
the aeroplane mode on.

**Android, [GPLv3](LICENSE).** Free, and free of ads, trackers and accounts.

[Get it on Google Play](https://play.google.com/store/apps/details?id=app.papervoice) · [papervoice.app](https://papervoice.app)

---

## Install

From [Google Play](https://play.google.com/store/apps/details?id=app.papervoice),
like any other app.

For a phone without Play, every release also carries the APK under one stable
name, so this link always gets the latest:
[papervoice.apk](https://github.com/shashankappu21/papervoice/releases/latest/download/papervoice.apk).
Android will warn you about installing from outside Google Play — that is
expected. Each release has a `papervoice.apk.sha256` beside it to check the
file against first:

```sh
sha256sum -c papervoice.apk.sha256
```

For updates without re-downloading by hand, point
[Obtainium](https://github.com/ImranR98/Obtainium) at this repository.

## What it does

- **PDF to speech.** Text is extracted with pdf.js, split into sentences, and
  read aloud by a neural voice.
- **Follow along.** The spoken sentence is highlighted and the page scrolls with
  it. Tap any sentence to jump there.
- **Fifteen natural voices**, eight male and seven female, three British. Every
  one is public domain — see [docs/voice-credits.md](docs/voice-credits.md),
  which is generated from an audit rather than written by hand.
- **Your phone's own voices** work too, with nothing to download, listed by
  name alongside the natural ones — American, British, Australian and Indian.
- **A voice for the book.** It suggests voices from the book's own text: a
  story or a textbook, British or American spelling.
- **It remembers where you were**, per book, to the sentence.
- **Sleep timer**: stop after a set time, or at the end of the chapter.
- **Groups**, so a shelf of textbooks is not one long list.
- Paper, light and dark themes; adjustable text size; speed from 0.5× to 3×.

It sends nothing on its own. The only things that ever leave the phone are a
voice you choose to download, and an optional questionnaire or feedback when
you press Send — never anything from your documents. The
[privacy policy](https://papervoice.app/privacy) lists exactly what each one
contains.

## What it does not do

- **Scanned PDFs.** There is no OCR. A PDF of photographs of pages has no text
  to read, and the app says so rather than pretending.
- **DRM-protected books.** Nothing from Kindle or Adobe DE.
- **iOS.** Android only.

---

## Building it

Requires Node 20+, a JDK, and the Android SDK.

```sh
npm install
npm run android          # debug build on a connected device or emulator
npm run apk              # release APK, both ABIs
npm run apk -- --fast    # arm64 only, for testing a release build quickly
npm test                 # no device needed
```

Build settings that should not be committed go in `.env` and `.env.local`
(both git-ignored), which every build script loads itself:
`EXPO_PUBLIC_FEEDBACK_ENDPOINT` for where feedback is sent, and
`GRADLE_USER_HOME` if Gradle should keep its cache somewhere other than the
default.

`npm run release -- --publish` builds, signs and publishes a GitHub release,
as a draft first, with the stable-named APK and checksums beside the
versioned one.

`android/` is **generated** by `expo prebuild` and is not committed. Anything
that needs to change in it lives in `plugins/` as a config plugin, because a
hand edit there disappears at the next prebuild with no sign that it has.

### The emulator

```sh
npm run emu:create       # once
npm run emu              # boot it
npm run emu -- --wipe    # boot it as a phone nobody has opened
npm run apk -- --emu     # x86_64 build, the only kind an emulator installs
```

Layout, navigation, insets and empty states are faithful on an emulator.
**Voice speed, audio routing and battery are not** — those need a real phone,
because the emulator runs on your computer's cores with no thermal limit.

---

### The website

[papervoice.app](https://papervoice.app) is the static page in [`site/`](site/),
published by GitHub Actions. [site/README.md](site/README.md) covers the voice
samples, the screenshots, the demo video and the release details written in at
deploy.

---

## Contributing

Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), which explains how a
PDF becomes sound and where each part of that lives.

The code is commented more heavily than is fashionable, and the comments are
mostly about **why** rather than what. Where something looks odd there is
usually a paragraph saying which bug it came from. Please keep that up: a
comment explaining what a line does is noise, one explaining why the obvious
version was wrong is the valuable part.

Some things worth knowing before you change anything:

- **`npm test` needs no device.** All the logic that can be tested without one
  is, and there are fixtures for the extraction pipeline.
- **Licences are enforced by a test.** `npm run audit:licences` re-derives every
  voice's licence from its source and follows "finetuned from X" chains;
  `__tests__/licences.test.ts` fails if the catalogue drifts from what was
  verified. Adding a voice means running the audit.
- **Check a model before adopting it**: `npm run audit:licences -- check <model>`
  judges a HuggingFace repo or Piper voice and says whether it can be shipped.
- **Measure, don't reason.** Several bugs here survived because someone
  reasoned about what the code must be doing instead of running it. There are
  tools for the recurring questions — `npm run phonemes` compares what a
  phonemiser produces against what a model accepts.

---

## Why it is GPLv3

Not by choice. eSpeak NG does the letters-to-sounds step for every neural voice,
it is GPLv3, and it is compiled into the native library this app links.

That has a consequence worth stating plainly: this app cannot be sold as
closed-source software, and the natural voices cannot be moved into a
proprietary build without replacing that one component. Everything else here is
permissively licensed.

[LICENSE-EXCEPTION](LICENSE-EXCEPTION) adds the section 7 permission that GPL
apps need to be distributed through an app store, conditional on the
unencumbered source remaining available somewhere anyone can reach without an
account.

## Credits

The voices are other people's work, released freely. They are listed with the
page each licence was read from in
[docs/voice-credits.md](docs/voice-credits.md) — in particular Bryce Beattie,
who trained most of them from public-domain LibriVox recordings and wrote down
the lineage, which is rarer than it should be.

Built on [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx),
[Piper](https://github.com/rhasspy/piper), [pdf.js](https://mozilla.github.io/pdf.js/)
and [Expo](https://expo.dev).
