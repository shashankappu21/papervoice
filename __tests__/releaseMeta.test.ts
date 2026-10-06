import { describe, expect, it } from 'vitest';
import * as meta from '../scripts/release/meta.mjs';

describe('the size shown for a download', () => {
  it('matches what the GitHub release page shows for the same file', () => {
    // The real v1.0.0 APK: 46,931,334 bytes, shown by GitHub as 44.8 MB.
    expect(meta.formatSize(46_931_334)).toBe('44.8 MB');
  });

  it('keeps a second decimal for small files', () => {
    expect(meta.formatSize(5 * 1024 * 1024 + 300_000)).toBe('5.29 MB');
  });
});

describe('the files published beside a release', () => {
  const apk = Buffer.from('not really an apk');
  const set = meta.assetSet({ version: '1.2.0', apkBytes: apk, minSdk: 24, versionCode: 5 });

  it('copies the APK under the stable name, byte for byte', () => {
    const stable = set.files.find((f) => f.name === 'papervoice.apk')!;
    expect(stable.bytes.equals(apk)).toBe(true);
  });

  it('writes checksums sha256sum -c can read, for both names', () => {
    const hash = meta.sha256(apk);
    const file = (name: string) => set.files.find((f) => f.name === name)!.bytes.toString();
    expect(file('papervoice.apk.sha256')).toBe(`${hash}  papervoice.apk\n`);
    expect(file('papervoice-1.2.0.apk.sha256')).toBe(`${hash}  papervoice-1.2.0.apk\n`);
  });

  it('records the minimum Android by name, from the API level', () => {
    expect(set.metadata.android).toBe('7.0');
    expect(set.metadata.apk).toEqual({
      name: 'papervoice.apk',
      versionedName: 'papervoice-1.2.0.apk',
      bytes: apk.length,
      sha256: meta.sha256(apk),
    });
  });

  it('leaves the minimum unknown rather than guessing it', () => {
    const unknown = meta.assetSet({ version: '1.2.0', apkBytes: apk });
    expect(unknown.metadata.android).toBeNull();
  });
});

describe("the release facts written into the page", () => {
  const page = `
    <p>Free. Android <span data-release="android">7.0</span>+. No account.</p>
    <p>Direct APK download · <span data-release="size">44.8 MB</span></p>
    <p>Version <span data-release="version">1.0.0</span></p>
    <code data-release="sha256">old</code>
    <p class="again">Direct APK download · <span data-release="size">44.8 MB</span></p>
    <script type="application/ld+json">{"softwareVersion": "1.0.0", "fileSize": "44.8 MB", "operatingSystem": "Android 7.0+"}</script>`;

  const release = {
    version: '1.1.0',
    android: '8.0',
    apk: { bytes: 50 * 1024 * 1024, sha256: 'abc123' },
  };

  it('updates every place a fact appears', () => {
    const out = meta.fillRelease(page, release);
    expect(out.match(/50\.0 MB/g)?.length).toBe(3); // two spans and the structured data
    expect(out).toContain('<span data-release="version">1.1.0</span>');
    expect(out).toContain('<code data-release="sha256">abc123</code>');
    expect(out).toContain('Android <span data-release="android">8.0</span>+');
    expect(out).toContain('"operatingSystem": "Android 8.0+"');
    expect(out).toContain('"softwareVersion": "1.1.0"');
  });

  it('keeps the page as it is when a fact is unknown', () => {
    const out = meta.fillRelease(page, { ...release, android: null });
    expect(out).toContain('<span data-release="android">7.0</span>');
  });

  it('reads back what the page shows', () => {
    expect(meta.readRelease(page)).toEqual({ version: '1.0.0', size: '44.8 MB', sha256: 'old', android: '7.0' });
  });
});
