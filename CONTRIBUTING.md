# Contributing

Thank you for looking. This is a small project and pull requests are genuinely
welcome.

## Start here

1. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how a PDF becomes sound
2. `npm install && npm test` — 268 tests, no device needed
3. `npm run emu:create && npm run emu` — an emulator configured for this app

## The house style

**Comments explain why, not what.** The code says what it does. A comment earns
its place by saying why the obvious version was wrong, what bug it came from, or
what will break if it changes. If you find yourself writing "increments the
counter", delete it.

**Measure before you conclude.** This project has a history of confident wrong
answers that survived because someone reasoned about what the code must be doing
rather than running it — a voice blamed on training epochs, a phoneme set
blamed on the wrong alphabet, a WebView blamed for a bug that was in a
backdrop's opacity. When a claim can be checked by running something, run it,
and then leave the check behind as a script.

**Name the tradeoff when you make one.** Several decisions here are genuinely
arguable — caching audio versus memory, copying a file versus holding it in
heap. Where you pick a side, say what it cost.

## Before opening a pull request

```sh
npm test            # must pass
npx tsc --noEmit    # must be clean
```

If you touched anything about voices, also:

```sh
npm run audit:licences
```

That re-derives every voice's licence from its primary source and follows
"finetuned from X" chains. It is enforced by a test, so a voice added without
running it will fail CI.

## Adding a voice

Check it before you adopt it:

```sh
npm run audit:licences -- check <huggingface-repo-or-piper-key>
```

It reports the licence, the lineage, whether the training data is described, and
the size against the on-device budget. A model must be **commercially usable to
its dataset and its lineage** — a permissive dataset over restricted weights is
not enough, and that mistake has already been made here once.

Then confirm it can actually speak with the phonemiser we have:

```sh
npm run phonemes -- compare ljspeech-medium <the new model's tokens or config>
```

Identical token maps mean one phonemiser serves both. Anything else needs
thinking about rather than shipping.

Voices ship **hidden** until somebody has listened to them. Epoch counts and
model cards do not predict whether a voice pronounces words correctly; only
listening does.

## What would help most

- **Anything in `docs/KNOWN_ISSUES.md`** — the open problems, with measurements
- **A phonemiser that is not GPL** and reproduces eSpeak's British output
  exactly. That single thing would change this project's licence options.
- **Extraction edge cases.** Two-column papers, footnotes, tables. Capture a
  fixture with `npm run fixture` and add a test.
- **Accessibility.** Screen-reader labels, focus order, contrast.
- **Translations**, once there is a string catalogue to translate.

## What to ask about first

Open an issue before starting on: anything that adds a network call, anything
that adds a dependency with a copyleft or non-commercial licence, and anything
that changes where a book's position is stored.

The first because "nothing leaves the phone" is the product. The second because
the licence situation here is already delicate. The third because losing
somebody's place in a ten-hour book is the worst thing this app can do.

## Licence

Contributions are under [GPLv3](LICENSE), like the rest of the project. By
opening a pull request you are agreeing to that.
