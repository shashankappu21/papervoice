import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * pdf.js is vendored (never fetched) so a document's bytes never touch the
 * network. Metro hands us the bundled copies as assets; the WebView cannot read
 * those directly, so they are staged into the cache directory under their real
 * names and the page loads them from there with a `file://` base URL.
 */
const SOURCES = [
  { name: 'pdf.min.mjs', module: require('../../assets/pdfjs/pdf.min.mjs.txt') },
  { name: 'pdf.worker.min.mjs', module: require('../../assets/pdfjs/pdf.worker.min.mjs.txt') },
];

/** Bump when the vendored pdf.js version changes so stale copies are replaced. */
const STAGE_DIR = 'pdfjs-6.3.289';

let staged: Promise<string> | null = null;

/**
 * Copies the vendored pdf.js files into the cache directory once per install
 * and resolves to the directory URI, with a trailing slash so it can be used
 * directly as a WebView `baseUrl`.
 */
export function stagePdfJs(): Promise<string> {
  staged ??= stage().catch((error) => {
    // A failed staging must not be cached, or every later import fails too.
    staged = null;
    throw error;
  });
  return staged;
}

async function stage(): Promise<string> {
  const dir = new Directory(Paths.cache, STAGE_DIR);
  if (!dir.exists) dir.create({ intermediates: true });

  for (const source of SOURCES) {
    const target = new File(dir, source.name);
    if (target.exists) continue;

    const asset = Asset.fromModule(source.module);
    await asset.downloadAsync();
    if (!asset.localUri) {
      throw new Error(`Could not stage ${source.name}: asset has no local URI`);
    }
    await new File(asset.localUri).copy(target);
  }

  return dir.uri.endsWith('/') ? dir.uri : `${dir.uri}/`;
}
