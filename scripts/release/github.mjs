/**
 * The handful of GitHub release calls the release scripts need, over plain
 * fetch: no gh CLI, no dependency.
 *
 * Reading a public repository needs no token. Writing -- uploading an asset --
 * takes one from GITHUB_TOKEN (what Actions provides) or, on a developer's
 * machine, from Git's own credential manager, which already holds a login for
 * github.com. The token is used for the request and never printed or written.
 */
import { execFileSync } from 'node:child_process';
import { sha256 } from './meta.mjs';

export const OWNER = 'shashankappu21';
export const REPO = 'papervoice';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

export { STABLE_APK, METADATA } from './meta.mjs';

let cached;
export function token() {
  if (cached !== undefined) return cached;
  if (process.env.GITHUB_TOKEN) return (cached = process.env.GITHUB_TOKEN);
  try {
    const out = execFileSync('git', ['credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8',
      // Never let the credential manager open a window or prompt: a script
      // that hangs waiting for a login is worse than one that says it has none.
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    cached = /^password=(.+)$/m.exec(out)?.[1] ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

function headers(extra = {}) {
  const auth = token();
  return {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': `${REPO}-release-scripts`,
    ...(auth ? { authorization: `Bearer ${auth}` } : {}),
    ...extra,
  };
}

async function json(response, what) {
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw httpError(`${what}: HTTP ${response.status} ${body.slice(0, 200)}`, response.status);
  }
  return response.json();
}

const httpError = (message, status) => Object.assign(new Error(message), { status });

/*
 * Retries, because a dropped connection halfway through a release is not
 * hypothetical: 1.0.1's draft failed with ECONNABORTED after a half-hour
 * build. Only what is worth retrying is retried: the network failing (fetch
 * throws a TypeError) and GitHub saying it is busy. A 404 or 422 is an answer.
 */
const TRIES = 4;
const BUSY = new Set([429, 500, 502, 503, 504]);
const transient = (error) => (error.status ? BUSY.has(error.status) : error instanceof TypeError);

/**
 * Runs `attempt` until it succeeds, a few times at most.
 *
 * A request that failed on the way back may still have happened. `recover`
 * runs before every retry to look: when it returns something, the earlier
 * attempt worked and that is the result.
 */
export async function retrying(what, attempt, recover, { wait = 3000 } = {}) {
  for (let n = 1; ; n++) {
    try {
      return await attempt();
    } catch (error) {
      if (!transient(error) || n === TRIES) throw error;
      const ms = wait * 2 ** (n - 1);
      console.warn(`  ${what} failed (${error.cause?.code ?? error.message}); trying again in ${ms / 1000} s`);
      await new Promise((resolve) => setTimeout(resolve, ms));
      const done = recover ? await recover() : null;
      if (done) return done;
    }
  }
}

/** A release by tag, or the latest published one when no tag is given. */
export async function getRelease(tag) {
  const url = tag ? `${API}/releases/tags/${encodeURIComponent(tag)}` : `${API}/releases/latest`;
  const what = `reading release ${tag ?? 'latest'}`;
  return retrying(what, async () => json(await fetch(url, { headers: headers() }), what));
}

export async function download(asset) {
  return retrying(`downloading ${asset.name}`, async () => {
    const response = await fetch(asset.browser_download_url, { headers: { 'user-agent': headers()['user-agent'] }, redirect: 'follow' });
    if (!response.ok) throw httpError(`downloading ${asset.name}: HTTP ${response.status}`, response.status);
    return Buffer.from(await response.arrayBuffer());
  });
}

export async function uploadAsset(release, name, bytes, contentType) {
  if (!token()) throw new Error('No GitHub token: set GITHUB_TOKEN, or sign Git in to github.com.');
  const url = `https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`;
  const hash = sha256(bytes);
  return retrying(
    `uploading ${name}`,
    async () =>
      json(
        await fetch(url, {
          method: 'POST',
          headers: headers({ 'content-type': contentType, 'content-length': String(bytes.length) }),
          body: bytes,
        }),
        `uploading ${name}`,
      ),
    // An upload cut off midway leaves a broken asset holding the name, and
    // one that only lost its reply leaves a good one. Keep the good one.
    async () => {
      const assets = await json(
        await fetch(`${API}/releases/${release.id}/assets?per_page=100`, { headers: headers() }),
        'listing assets',
      );
      const there = assets.find((asset) => asset.name === name);
      if (!there) return null;
      if (there.state === 'uploaded' && there.size === bytes.length && (digestOf(there) ?? hash) === hash) return there;
      await deleteAsset(there);
      return null;
    },
  );
}

/** Whether a release with this tag exists, drafts included. */
export async function releaseExists(tag) {
  if (!token()) throw new Error('No GitHub token.');
  return retrying(`checking ${tag}`, async () => {
    const response = await fetch(`${API}/releases/tags/${encodeURIComponent(tag)}`, { headers: headers() });
    // Drafts are invisible to the tag lookup, so look through the list too.
    if (response.status === 404) return Boolean(await findRelease(tag));
    if (!response.ok) throw httpError(`checking ${tag}: HTTP ${response.status}`, response.status);
    return true;
  });
}

/** A release by tag, drafts included, or null. */
async function findRelease(tag) {
  const list = await json(await fetch(`${API}/releases?per_page=100`, { headers: headers() }), 'listing releases');
  return list.find((release) => release.tag_name === tag) ?? null;
}

/** Created as a draft: not "latest" until every file is on it. */
export async function createDraft({ tag, target, name, body }) {
  if (!token()) throw new Error('No GitHub token.');
  return retrying(
    `creating ${tag}`,
    async () =>
      json(
        await fetch(`${API}/releases`, {
          method: 'POST',
          headers: headers({ 'content-type': 'application/json' }),
          body: JSON.stringify({ tag_name: tag, target_commitish: target, name, body, draft: true, make_latest: 'true' }),
        }),
        `creating ${tag}`,
      ),
    // The draft may have been made and only the reply lost: use it, rather
    // than making a second one.
    async () => {
      const there = await findRelease(tag);
      return there?.draft ? there : null;
    },
  );
}

// Publishing twice is the same as publishing once, so it simply retries.
export async function publishDraft(release) {
  const what = `publishing ${release.tag_name}`;
  return retrying(what, async () =>
    json(
      await fetch(`${API}/releases/${release.id}`, {
        method: 'PATCH',
        headers: headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ draft: false, make_latest: 'true' }),
      }),
      what,
    ),
  );
}

export async function deleteAsset(asset) {
  if (!token()) throw new Error('No GitHub token.');
  await retrying(`deleting ${asset.name}`, async () => {
    const response = await fetch(`${API}/releases/assets/${asset.id}`, { method: 'DELETE', headers: headers() });
    // 404: already gone, which is what was wanted.
    if (!response.ok && response.status !== 404) throw httpError(`deleting ${asset.name}: HTTP ${response.status}`, response.status);
  });
}

/** GitHub records a sha256 for every asset uploaded since mid-2025. */
export const digestOf = (asset) => /^sha256:([0-9a-f]{64})$/.exec(asset?.digest ?? '')?.[1] ?? null;
