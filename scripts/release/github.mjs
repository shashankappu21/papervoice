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
    throw new Error(`${what}: HTTP ${response.status} ${body.slice(0, 200)}`);
  }
  return response.json();
}

/** A release by tag, or the latest published one when no tag is given. */
export async function getRelease(tag) {
  const url = tag ? `${API}/releases/tags/${encodeURIComponent(tag)}` : `${API}/releases/latest`;
  return json(await fetch(url, { headers: headers() }), `reading release ${tag ?? 'latest'}`);
}

export async function download(asset) {
  const response = await fetch(asset.browser_download_url, { headers: { 'user-agent': headers()['user-agent'] }, redirect: 'follow' });
  if (!response.ok) throw new Error(`downloading ${asset.name}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function uploadAsset(release, name, bytes, contentType) {
  if (!token()) throw new Error('No GitHub token: set GITHUB_TOKEN, or sign Git in to github.com.');
  const url = `https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`;
  return json(
    await fetch(url, {
      method: 'POST',
      headers: headers({ 'content-type': contentType, 'content-length': String(bytes.length) }),
      body: bytes,
    }),
    `uploading ${name}`,
  );
}

/** Whether a release with this tag exists, drafts included. */
export async function releaseExists(tag) {
  if (!token()) throw new Error('No GitHub token.');
  const response = await fetch(`${API}/releases/tags/${encodeURIComponent(tag)}`, { headers: headers() });
  if (response.status === 404) {
    // Drafts are invisible to the tag lookup, so look through the list too.
    const list = await json(await fetch(`${API}/releases?per_page=100`, { headers: headers() }), 'listing releases');
    return list.some((release) => release.tag_name === tag);
  }
  if (!response.ok) throw new Error(`checking ${tag}: HTTP ${response.status}`);
  return true;
}

/** Created as a draft: not "latest" until every file is on it. */
export async function createDraft({ tag, target, name, body }) {
  if (!token()) throw new Error('No GitHub token.');
  return json(
    await fetch(`${API}/releases`, {
      method: 'POST',
      headers: headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ tag_name: tag, target_commitish: target, name, body, draft: true, make_latest: 'true' }),
    }),
    `creating ${tag}`,
  );
}

export async function publishDraft(release) {
  return json(
    await fetch(`${API}/releases/${release.id}`, {
      method: 'PATCH',
      headers: headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ draft: false, make_latest: 'true' }),
    }),
    `publishing ${release.tag_name}`,
  );
}

export async function deleteAsset(asset) {
  if (!token()) throw new Error('No GitHub token.');
  const response = await fetch(`${API}/releases/assets/${asset.id}`, { method: 'DELETE', headers: headers() });
  if (!response.ok && response.status !== 404) throw new Error(`deleting ${asset.name}: HTTP ${response.status}`);
}

/** GitHub records a sha256 for every asset uploaded since mid-2025. */
export const digestOf = (asset) => /^sha256:([0-9a-f]{64})$/.exec(asset?.digest ?? '')?.[1] ?? null;
