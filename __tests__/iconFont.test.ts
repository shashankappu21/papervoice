import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const plugin = require('../plugins/withIconFont.js');
const root = path.resolve(__dirname, '..');

describe('the icon font built into the APK', () => {
  it('is named for the family @expo/vector-icons actually asks for', () => {
    // Android takes the family from the file name, case-sensitively. The
    // library asks for one name and ships the file under another; if these two
    // ever disagree the icons silently go back to loading late.
    const ionicons = readFileSync(
      require.resolve('@expo/vector-icons/build/Ionicons.js', { paths: [root] }),
      'utf8',
    );
    const asked = /createIconSet\(\s*\w+\s*,\s*'([^']+)'/.exec(ionicons)?.[1];

    expect(asked).toBe(plugin.FAMILY);
  });

  it('lands in assets/fonts under that name, byte for byte the installed font', () => {
    const android = mkdtempSync(path.join(tmpdir(), 'pv-android-'));
    try {
      const written: string = plugin.embedIconFont(root, android);

      expect(path.basename(written)).toBe(`${plugin.FAMILY}.ttf`);
      expect(written).toBe(path.join(android, 'app', 'src', 'main', 'assets', 'fonts', 'ionicons.ttf'));

      const installed = readFileSync(require.resolve(plugin.SOURCE, { paths: [root] }));
      expect(readFileSync(written).equals(installed)).toBe(true);
    } finally {
      rmSync(android, { recursive: true, force: true });
    }
  });
});
