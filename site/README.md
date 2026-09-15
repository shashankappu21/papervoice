# papervoice.app

Two static files. No build step, no framework, no dependencies.

    index.html     the landing page
    privacy.html   the privacy policy, which Play requires at a public URL
    CNAME          the custom domain, for GitHub Pages

## Hosting it

**GitHub Pages** — Settings → Pages → deploy from branch, folder `/site`. The
`CNAME` file points it at the domain; add these DNS records at your registrar:

    A     @    185.199.108.153
    A     @    185.199.109.153
    A     @    185.199.110.153
    A     @    185.199.111.153
    CNAME www  OWNER.github.io

**Vercel** — import the repo, set the root directory to `site`, framework
"Other". Add the domain in the dashboard and follow its DNS instructions.

Either is free and gives HTTPS automatically, which `.app` requires: the whole
TLD is HSTS-preloaded, so a site served over plain HTTP simply will not load.

## Before it goes live

- Replace `OWNER` with the GitHub username in both HTML files
- Add screenshots — a page about an app with no picture of it is a poor advert
- Point the download button at the real release once one exists
