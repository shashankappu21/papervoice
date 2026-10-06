# papervoice.app

Two static pages. No build step, no framework, no dependencies, and nothing
loaded from a third party — not a font, not a tracker.

    index.html     the landing page
    privacy.html   the privacy policy, which Play requires at a public URL
    img/           screenshots of the app, from design/raw/
    audio/         voice samples: real Papervoice output, fetched only on a press
    fonts/         Playfair Display and Jost, subset to this page, with the
                   OFL notices that have to ship beside them
    og.png         the social card
    CNAME          the custom domain, for GitHub Pages

The page sells the outcome first — getting through the PDFs you keep meaning
to read — and treats the voices, the offline mode and the rest as the proof of
it. It offers two ways in, side by side: **Download for Android**, which is the
APK straight from the latest GitHub release, and **Request a Play Store beta
invite**, for anyone who would rather install from Google Play.

## The download

Every download button points at one URL:

    https://github.com/shashankappu21/papervoice/releases/latest/download/papervoice.apk

That only works if every release carries an APK under that exact name, so each
release has, beside its versioned `papervoice-X.Y.Z.apk`:

    papervoice.apk                byte-for-byte the same file
    papervoice.apk.sha256         checksums, in sha256sum's format
    papervoice-X.Y.Z.apk.sha256
    papervoice.json               version, size, checksum, minimum Android

`npm run release -- --publish` builds, signs, and publishes all of them, as a
draft first, so "latest" never points at a release without `papervoice.apk`.
For a release made by hand, the `release-assets` workflow copies the versioned
APK under the stable name and adds the rest. `node scripts/releaseAssets.mjs`
does the same from a laptop, and `--check` reports without changing anything.
The APK is copied from the published asset and checked against GitHub's own
digest; nothing is rebuilt or re-signed, and no key is involved.

The version, size, checksum and minimum Android on the page come from
`papervoice.json` and are written into the HTML at deploy, by
`scripts/siteRelease.mjs` — so no visit asks GitHub for anything. The deploy
fails if the stable APK does not resolve, rather than publishing a page whose
main button is a 404. `node scripts/siteRelease.mjs --check` compares the page
with the live release.

## Voice samples

    npm run site:samples

Writes `audio/<voice-id>.opus` and `.m4a` for every voice the app offers, and
rewrites the sample buttons — under the hero image and in the voices section —
to match exactly the voices that have a recording. A voice without one gets no
button, rather than a broken one.

Recordings, first match wins:

    design/site-audio/<voice-id>.{wav,flac,m4a,mp3,opus,ogg}   supplied by hand
    assets/samples/<voice-id>.opus                             the app's own

The app's own are its in-app previews: real output of each voice's model, every
voice reading the same sentence, three to five seconds each. Longer samples —
around ten seconds — go in `design/site-audio/`, named by voice id (Lyra is
`ljspeech-medium`). **Every voice should read the same passage**, so they can
be compared; the generator says so when they are mixed. Only Papervoice's own
voices belong here — never another TTS service, never generated narration.

Nothing is downloaded until a sample is pressed. There is no `<audio>` element
and no preload: one player is created on the first press and given a file only
then, Opus where the browser plays it and AAC where it does not.

## The two things to fill in

Both live at the top of the script at the bottom of `index.html`.

**`EARLY_ACCESS_ENDPOINT`** — the deployed Google Apps Script web-app URL. It
receives JSON:

    { email, timestamp, utm_source, utm_medium, utm_campaign, utm_content,
      referrer }

and answers `{ ok: true }` or `{ ok: false, error: '...' }`. The script, and
the steps to deploy it, are in [`early-access/`](../early-access/) — a Google
Sheet and forty lines of Apps Script, with no vendor and nothing to pay for.

The success panel appears only when the endpoint confirms `ok: true`. A
refusal shows the server's own message inline; anything else shows a generic
error and the fallback address. A submission already in flight ignores further
clicks.

The body goes as `text/plain`, not `application/json`. Any other content type
makes the browser send a CORS preflight, and an Apps Script web app does not
answer `OPTIONS`, so the request would fail before it was made.

Until the URL is set, the form opens a pre-addressed email to
`hello@papervoice.app` instead. That is deliberate: showing "You're in." after
a request that went nowhere would be a lie to someone who wanted in.

**`BETA_OPT_IN_URL`** — the Play Console tester opt-in link. The "Join the
Android beta" line stays hidden until this is set.

## Analytics

`ANALYTICS_ENDPOINT` is empty, and nothing is sent anywhere by default. A page
whose subject is that the app does not watch you has no business loading
someone else's tracker.

Every event is dispatched as a DOM event, so anything can listen:

    document.addEventListener('papervoice:track', e => console.log(e.detail));

Events: `page_view`, `early_access_click`, `early_access_submit`,
`github_click`, `beta_join_click`. Each carries any `utm_*` tags from the
landing URL, which are kept in `sessionStorage` for the visit so a sign-up
further down the page is still attributed to the campaign that brought them.

Set `ANALYTICS_ENDPOINT` to something you host and the same payloads are
POSTed there. If you ever point it at a third party, say so in
`privacy.html` first.

## Regenerating the images and fonts

    npm run site:assets

Rebuilds `img/`, the icons, `og.png` and the subset fonts from the real
screen captures in `design/raw/` — the same ones the Play listing uses. The
app screenshots on the page are the app, not a mockup, and that only stays
true if they are regenerated when the app changes.

## Hosting it

**GitHub Pages** — Settings → Pages → Source: **GitHub Actions**. The workflow
in `.github/workflows/site.yml` publishes this folder.

Not "deploy from a branch": that offers only the repository root or `/docs`,
and this is neither. Actions is how Pages publishes an arbitrary folder.

The `CNAME` file points it at the domain; add these DNS records at your
registrar:

    A     @    185.199.108.153
    A     @    185.199.109.153
    A     @    185.199.110.153
    A     @    185.199.111.153
    CNAME www  shashankappu21.github.io

**Vercel** — import the repo, set the root directory to `site`, framework
"Other". Add the domain in the dashboard and follow its DNS instructions.

Either is free and gives HTTPS automatically, which `.app` requires: the whole
TLD is HSTS-preloaded, so a site served over plain HTTP simply will not load.

## Looking at it before it ships

    cd site && python -m http.server 8765

Then open <http://127.0.0.1:8765>. It has to be served rather than opened as a
file, because the fonts and images are referenced from the site root.

## Before it goes live

- Deploy `early-access/Code.gs` and set `EARLY_ACCESS_ENDPOINT`, or the form
  falls back to opening a mail client
- Set `BETA_OPT_IN_URL` once internal testing has an opt-in link
- When the Google Play closed test is live, swap the beta section's line for
  the "in testing" wording kept in a comment beside it
- Longer voice samples, if wanted: see "Voice samples" above
