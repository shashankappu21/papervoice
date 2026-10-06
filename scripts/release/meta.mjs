/**
 * What a release publishes besides the APK, and how the website shows it.
 *
 * Pure -- no network, no filesystem -- so it is tested, and so the local
 * publish path and the Actions backstop produce exactly the same files.
 */
import { createHash } from 'node:crypto';

export const STABLE_APK = 'papervoice.apk';
export const METADATA = 'papervoice.json';

/** Android's version for an API level, as people know it. */
export const ANDROID = {
  21: '5.0', 22: '5.1', 23: '6.0', 24: '7.0', 25: '7.1', 26: '8.0', 27: '8.1',
  28: '9', 29: '10', 30: '11', 31: '12', 32: '12L', 33: '13', 34: '14', 35: '15', 36: '16',
};

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** One line in sha256sum's own format, so `sha256sum -c` reads it. */
export const sumLine = (hash, name) => `${hash}  ${name}\n`;

/**
 * Bytes as GitHub's release page shows them: 46,931,334 -> "44.8 MB".
 *
 * Binary megabytes under the decimal label, because that is what the release
 * page a visitor may check against says. Matching it matters more than the
 * unit's pedigree: two different numbers for one file read as two files.
 */
export function formatSize(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? mb.toFixed(1) : mb.toFixed(2)} MB`;
}

/**
 * Everything published alongside a release's versioned APK.
 *
 * @param {{ version: string, apkBytes: Buffer, minSdk?: number | null, versionCode?: number | null,
 *           publishedAt?: string | null, tag?: string }} release
 */
export function assetSet({ version, apkBytes, minSdk = null, versionCode = null, publishedAt = null, tag }) {
  const versionedName = `papervoice-${version}.apk`;
  const hash = sha256(apkBytes);
  const metadata = {
    tag: tag ?? `v${version}`,
    version,
    versionCode,
    minSdk,
    android: minSdk ? ANDROID[minSdk] ?? null : null,
    apk: { name: STABLE_APK, versionedName, bytes: apkBytes.length, sha256: hash },
    publishedAt,
  };
  return {
    versionedName,
    hash,
    metadata,
    files: [
      { name: STABLE_APK, bytes: apkBytes, type: 'application/vnd.android.package-archive' },
      { name: `${STABLE_APK}.sha256`, bytes: Buffer.from(sumLine(hash, STABLE_APK)), type: 'text/plain' },
      { name: `${versionedName}.sha256`, bytes: Buffer.from(sumLine(hash, versionedName)), type: 'text/plain' },
      { name: METADATA, bytes: Buffer.from(JSON.stringify(metadata, null, 2) + '\n'), type: 'application/json' },
    ],
  };
}

/**
 * Writes a release's facts into the page, wherever it asks for them.
 *
 *   <span data-release="size">44.8 MB</span>
 *
 * The values are in the HTML itself rather than fetched when the page loads:
 * no request to GitHub on every visit, nothing missing with JavaScript off,
 * and the page served is the page that was checked. Elements are found by
 * attribute, so moving them in the markup needs no change here.
 */
export function fillRelease(html, meta) {
  const values = {
    version: meta.version,
    size: formatSize(meta.apk.bytes),
    sha256: meta.apk.sha256,
    android: meta.android,
  };

  let out = html;
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    out = out.replace(
      new RegExp(`(<([a-z]+)[^>]*\\bdata-release="${key}"[^>]*>)[^<]*(</\\2>)`, 'g'),
      (_whole, open, _tag, close) => `${open}${value}${close}`,
    );
  }

  // The structured data for search engines carries the same facts.
  out = out.replace(/("softwareVersion":\s*")[^"]*(")/, `$1${meta.version}$2`);
  out = out.replace(/("fileSize":\s*")[^"]*(")/, `$1${values.size}$2`);
  if (meta.android) out = out.replace(/("operatingSystem":\s*"Android )[^+"]*(\+?")/, `$1${meta.android}$2`);
  return out;
}

/** The facts the page currently shows, for checking it against a release. */
export function readRelease(html) {
  const read = (key) => new RegExp(`data-release="${key}"[^>]*>([^<]*)<`).exec(html)?.[1] ?? null;
  return { version: read('version'), size: read('size'), sha256: read('sha256'), android: read('android') };
}
