import { describe, expect, it } from 'vitest';
import { isPdfUri, titleFromUri } from '../src/import/incomingPdf';

describe('isPdfUri', () => {
  it('accepts what a file manager hands over', () => {
    expect(isPdfUri('content://com.android.providers.downloads.documents/document/1234')).toBe(true);
    expect(isPdfUri('file:///storage/emulated/0/Download/Sapiens.pdf')).toBe(true);
  });

  it('refuses the app opening itself', () => {
    // The deep link scheme the app already answers on. Treating that as a
    // document would try to import the act of being launched.
    expect(isPdfUri('papervoice://')).toBe(false);
    expect(isPdfUri('papervoice:///reader/3')).toBe(false);
  });

  it('refuses nothing at all', () => {
    expect(isPdfUri(null)).toBe(false);
    expect(isPdfUri('')).toBe(false);
  });

  it('refuses a web address', () => {
    // Nothing is downloaded. A document arrives from the phone or not at all.
    expect(isPdfUri('https://example.com/book.pdf')).toBe(false);
  });
});

describe('titleFromUri', () => {
  it('reads the name out of a storage provider uri', () => {
    expect(
      titleFromUri(
        'content://com.android.externalstorage.documents/document/primary%3ADownload%2FNever%20Split%20the%20Difference.pdf',
      ),
    ).toBe('Never Split the Difference');
  });

  it('reads the name out of a plain file path', () => {
    expect(titleFromUri('file:///storage/emulated/0/Books/Sapiens.pdf')).toBe('Sapiens');
  });

  it('drops a query string', () => {
    expect(titleFromUri('content://provider/doc/Atomic%20Habits.pdf?take=1')).toBe('Atomic Habits');
  });

  it('falls back when the uri carries no filename', () => {
    // MediaStore hands over an id and keeps the name to itself. Renaming is
    // possible from the library, so a plain fallback beats a wrong guess.
    expect(titleFromUri('content://media/external/file/28461')).toBe('Imported document');
    expect(titleFromUri('content://downloads/public_downloads/931')).toBe('Imported document');
  });

  it('falls back rather than returning something unusable', () => {
    expect(titleFromUri('content://provider/document/')).toBe('Imported document');
    expect(titleFromUri('')).toBe('Imported document');
  });

  it('tidies the whitespace a decoded name can carry', () => {
    expect(titleFromUri('file:///books/The%20%20Long%20%20Walk.pdf')).toBe('The Long Walk');
  });
});
