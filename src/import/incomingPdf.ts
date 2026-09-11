/**
 * A PDF handed to the app from somewhere else.
 *
 * Android offers Papervoice in the "open with" list, so a document can arrive
 * without ever going through the picker. What arrives is a uri and nothing
 * else: no name, no size, no promise that it is readable.
 */

/** What the app answers on for its own deep links, which are not documents. */
const OWN_SCHEME = 'papervoice:';

export function isPdfUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  if (uri.startsWith(OWN_SCHEME)) return false;

  // Nothing is downloaded. A document comes from the phone or not at all --
  // which is the same promise the rest of the app makes.
  return uri.startsWith('content://') || uri.startsWith('file://');
}

export const FALLBACK_TITLE = 'Imported document';

/**
 * A name for the book, taken from the uri.
 *
 * This is a guess and is treated as one. A storage provider usually encodes
 * the path in the uri, so the name is there to be read; MediaStore hands over
 * a number and keeps the name to itself. Rather than query Android for the
 * display name -- which needs a content resolver, and so native code -- the
 * guess falls back to something plain and the library lets it be renamed.
 */
export function titleFromUri(uri: string): string {
  let decoded = uri;
  try {
    decoded = decodeURIComponent(uri);
  } catch {
    // A malformed escape is not worth failing an import over.
  }

  // A uri can encode a path inside its last segment, separated by either a
  // slash or a colon: content://…/document/primary:Download/Book.pdf
  const withoutQuery = decoded.split('?')[0];
  const last = withoutQuery.split(/[/:]/).filter(Boolean).pop() ?? '';

  /*
   * Only a segment that actually ends in .pdf is treated as a name. Without
   * that, a uri ending in a slash yields whatever path component came last --
   * "document", "file", "downloads" -- and the book gets named after a piece
   * of plumbing. A provider that gives no filename gives no name, and saying
   * so plainly beats a confident wrong answer.
   */
  if (!/\.pdf$/i.test(last)) return FALLBACK_TITLE;

  const name = last.replace(/\.pdf$/i, '').replace(/\s+/g, ' ').trim();
  return name || FALLBACK_TITLE;
}
