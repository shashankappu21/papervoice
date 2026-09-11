import { isPdfUri } from '../src/import/incomingPdf';
import { offerImport } from '../src/import/pendingImport';

/**
 * What to do with a link Android hands the app.
 *
 * A PDF opened from a file manager arrives here as a uri, and the router will
 * otherwise try to navigate to it: `content://media/external/file/28461`
 * becomes a path, matches no screen, and the app opens on "Unmatched Route"
 * with the document forgotten. That is exactly what it did.
 *
 * So a document is taken out of the routing entirely -- handed to the importer
 * and replaced with the library, which is where the book is about to appear.
 * Anything else is left alone, because the app's own deep links still need to
 * work.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (isPdfUri(path)) {
      offerImport(path);
      return '/';
    }
  } catch {
    // The router's own note on this method: throwing here can take the app
    // down with it. A link that cannot be understood is not worth that.
    return '/';
  }

  return path;
}
