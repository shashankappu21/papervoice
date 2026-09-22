# The early-access list

The whole backend behind **Get early access** on papervoice.app: a Google
Sheet, and an Apps Script bound to it that appends a row.

No vendor, no account, nothing to pay for, and nothing stored anywhere but a
spreadsheet you own — which is the least that can be held about someone who
only wanted to be invited to a beta.

    Code.gs      the web app: doPost validates, de-duplicates, appends

## Setting it up

1. **Make a spreadsheet.** [sheets.new](https://sheets.new). Name it something
   like *Papervoice early access*. The `signups` tab and its header row are
   created on the first submission, so there is nothing to lay out.

2. **Open the script editor.** In that sheet: **Extensions → Apps Script**.
   It must be opened from the sheet, so the script is bound to it — a
   standalone script has no "active spreadsheet" to write to.

3. **Paste `Code.gs`** over whatever is in `Code.gs` there, and save.

4. **Deploy.** **Deploy → New deployment → ⚙ → Web app**, then:

   - **Execute as:** *Me*
   - **Who has access:** *Anyone*

   "Anyone" means anyone may POST to the URL. That is what a public sign-up
   form is. It does not give anyone sight of the sheet.

5. **Authorise it.** Google will warn that the app is unverified, because it
   is your own script rather than a published add-on. *Advanced → Go to
   (project name)* → **Allow**. It asks only for access to the spreadsheet.

6. **Copy the web-app URL.** It looks like
   `https://script.google.com/macros/s/AKfy.../exec`.

7. **Paste it into the site.** In `site/index.html`, near the top of the
   script at the bottom:

   ```js
   var EARLY_ACCESS_ENDPOINT = 'https://script.google.com/macros/s/AKfy.../exec';
   ```

   Until it is set, the form opens a pre-addressed email instead.

8. **Check it.** Open the URL in a browser: it should answer
   `{"ok":true,"service":"papervoice-early-access"}`. Then submit the form on
   the site and watch a row appear.

## Redeploying after a change

Apps Script keeps serving the deployed version, not the saved one. After
editing `Code.gs`: **Deploy → Manage deployments → ✏️ → Version: New version →
Deploy**. The URL stays the same. Deploying a *new deployment* instead gives a
new URL, and the old one keeps running the old code.

## What is stored

One row per address:

    timestamp     when the browser submitted
    email
    utm_source    the campaign tags from the link they arrived through,
    utm_medium    empty when there were none
    utm_campaign
    utm_content
    referrer      the page they came from, when the browser sent one
    received_at   when the script wrote the row

Nothing else is collected, and `site/privacy.html` says so. If that ever
changes, change the policy in the same commit.

## Things worth knowing

**The request is sent as `text/plain`.** Not because the body is text — it is
JSON — but because any other content type makes the browser send a CORS
preflight, and an Apps Script web app does not answer `OPTIONS`. The request
would fail before it was ever made. Apps Script reads `e.postData.contents`
identically either way. If you replace this backend with something that does
answer preflight, `application/json` is the better header.

**A 200 does not mean it worked.** Apps Script answers 200 with its own body
even when it refused, so the page checks `ok` in the JSON rather than the
status code.

**Duplicates are accepted quietly.** Someone who signs up twice is told
they're in, because they are. Set `SKIP_DUPLICATES = false` to record every
submission instead.

**The form has a honeypot.** A hidden `company` field no person sees. When it
arrives filled in, the script answers `{ ok: true }` and stores nothing —
saying why would only teach the bot to try again.

**The endpoint is public.** Anyone who finds the URL can add rows. For a beta
list that is an acceptable trade for having no accounts and no vendor; the
honeypot stops the careless bots. If it is ever abused, the options are a
shared secret in the body, a CAPTCHA, or moving to a service with rate
limiting — in roughly that order of intrusiveness.

**Quotas.** Apps Script allows tens of thousands of executions a day on a free
account, far beyond what a beta list needs.

## Not done yet

Automatic enrolment into the Play tester group. Invites are sent by hand for
now: copy the addresses out of the sheet into **Play Console → Internal
testing → Testers**.
