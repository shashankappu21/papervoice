# papervoice.app

Two static pages. No build step, no framework, no dependencies, and nothing
loaded from a third party — not a font, not a tracker.

    index.html     the landing page
    privacy.html   the privacy policy, which Play requires at a public URL
    img/           screenshots of the app, from design/raw/
    fonts/         Playfair Display and Jost, subset to this page
    og.png         the social card
    CNAME          the custom domain, for GitHub Pages

The page sells the outcome first — getting through the PDFs you keep meaning
to read — and treats the voices, the offline mode and the rest as the proof of
it. The one conversion goal is **Get early access**; the APK and the source
are kept as secondary links, for the people who want them.

## The two things to fill in

Both live at the top of the script at the bottom of `index.html`.

**`EARLY_ACCESS_ENDPOINT`** — a URL that accepts `POST` with a JSON body:

    { email, timestamp, utm_source, utm_medium, utm_campaign, referrer }

and answers 2xx once the address is stored. Nothing else is collected.

Until it is set, the form opens a pre-addressed email to `hello@papervoice.app`
instead. That is deliberate: showing "You're in." after a request that went
nowhere would be a lie to someone who wanted in. No vendor has been chosen —
a form service, a Google Apps Script bound to a Sheet, or a small function
would all do.

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

- Set `EARLY_ACCESS_ENDPOINT`, or the form falls back to opening a mail client
- Set `BETA_OPT_IN_URL` once internal testing has an opt-in link
- The releases page is linked from the FAQ and the footer, and is empty until
  a release is published
