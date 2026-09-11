import { Directory, File, Paths } from 'expo-file-system';
import { database } from './connection';
import type { ExtractedDoc, Sentence } from '../extraction/types';
import type { OutlineEntry } from '../extraction/sections';
import { bookDirectory } from '../tts/audioCache';

export interface Book {
  id: number;
  title: string;
  /** The copy this app owns, not the picked URI, which does not outlive the pick. */
  uri: string;
  sentencesPath: string;
  pageCount: number;
  sentenceCount: number;
  addedAt: number;
  lastOpenedAt: number | null;
  /** Where the reader left off, or 0 for a book never opened. */
  position: number;
  /** Page one, drawn at import. Null for books added before covers existed. */
  coverPath: string | null;
  /**
   * The document's own contents. Null when it has not been looked for yet,
   * empty when it was looked for and the file records none -- a distinction
   * that stops the search being repeated on every book that lacks one.
   */
  outline: OutlineEntry[] | null;
}

function booksDirectory(): Directory {
  const dir = new Directory(Paths.document, 'books');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * Takes ownership of a picked document.
 *
 * The picker hands back a temporary grant that stops working once the app
 * restarts, so the file is copied somewhere this app controls before anything
 * refers to it again.
 */
export async function addBook(
  pickedUri: string,
  title: string,
  doc: ExtractedDoc,
): Promise<Book> {
  const dir = booksDirectory();
  const stamp = Date.now();

  const pdf = new File(dir, `${stamp}.pdf`);
  await new File(pickedUri).copy(pdf);

  // Written before the row, so a book is never listed pointing at a picture
  // that is not there yet.
  let coverPath: string | null = null;
  if (doc.cover) {
    try {
      const cover = new File(dir, `${stamp}.cover.jpg`);
      cover.create({ overwrite: true });
      cover.write(Uint8Array.from(atob(doc.cover), (c) => c.charCodeAt(0)));
      coverPath = cover.uri;
    } catch {
      // Decoration. A book that imports without its cover is still a book.
      coverPath = null;
    }
  }

  const sentences = new File(dir, `${stamp}.sentences.json`);
  // overwrite: a file object has no idempotent flag, and create() throws on a
  // name that is already taken.
  sentences.create({ overwrite: true });
  sentences.write(JSON.stringify(doc.sentences));

  const db = await database();
  const result = await db.runAsync(
    `INSERT INTO books (title, uri, sentences_path, page_count, sentence_count, added_at, last_opened_at, cover_path, outline)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    title,
    pdf.uri,
    sentences.uri,
    doc.pageCount,
    doc.sentences.length,
    stamp,
    stamp,
    coverPath,
    JSON.stringify(doc.outline ?? []),
  );

  return {
    id: result.lastInsertRowId,
    title,
    uri: pdf.uri,
    sentencesPath: sentences.uri,
    pageCount: doc.pageCount,
    sentenceCount: doc.sentences.length,
    addedAt: stamp,
    lastOpenedAt: stamp,
    position: 0,
    coverPath,
    outline: doc.outline ?? [],
  };
}

interface BookRow {
  id: number;
  title: string;
  uri: string;
  sentences_path: string;
  page_count: number;
  sentence_count: number;
  added_at: number;
  last_opened_at: number | null;
  sentence_index: number | null;
  cover_path: string | null;
  outline: string | null;
}

const toBook = (row: BookRow): Book => ({
  id: row.id,
  title: row.title,
  uri: row.uri,
  sentencesPath: row.sentences_path,
  pageCount: row.page_count,
  sentenceCount: row.sentence_count,
  addedAt: row.added_at,
  lastOpenedAt: row.last_opened_at,
  position: row.sentence_index ?? 0,
  coverPath: row.cover_path,
  outline: readOutline(row.outline),
});

/** A stored contents page, or null when the column has never been written. */
function readOutline(stored: string | null): OutlineEntry[] | null {
  if (stored === null) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as OutlineEntry[]) : [];
  } catch {
    // Unreadable is the same as absent, and the headings still work.
    return [];
  }
}

const SELECT = `
  SELECT b.*, p.sentence_index
  FROM books b
  LEFT JOIN positions p ON p.book_id = b.id
`;

/** Most recently opened first: the book someone is reading is the one they want. */
export async function listBooks(): Promise<Book[]> {
  const db = await database();
  const rows = await db.getAllAsync<BookRow>(
    `${SELECT} ORDER BY COALESCE(b.last_opened_at, b.added_at) DESC`,
  );
  return rows.map(toBook);
}

export async function getBook(id: number): Promise<Book | null> {
  const db = await database();
  const row = await db.getFirstAsync<BookRow>(`${SELECT} WHERE b.id = ?`, id);
  return row ? toBook(row) : null;
}

/** Reads a book's sentences back from disk, where they were kept out of the database. */
export function readSentences(book: Book): Sentence[] {
  return JSON.parse(new File(book.sentencesPath).textSync()) as Sentence[];
}

/**
 * Records where the reader has reached.
 *
 * Called often -- on a timer and on every lifecycle event -- because the
 * position has to survive the process being killed without warning, which is
 * the ordinary way an Android app ends.
 */
export async function savePosition(bookId: number, sentenceIndex: number): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT INTO positions (book_id, sentence_index, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(book_id) DO UPDATE SET sentence_index = excluded.sentence_index,
                                        updated_at = excluded.updated_at`,
    bookId,
    sentenceIndex,
    Date.now(),
  );
}

export async function touchBook(bookId: number): Promise<void> {
  const db = await database();
  await db.runAsync('UPDATE books SET last_opened_at = ? WHERE id = ?', Date.now(), bookId);
}

/**
 * Gives a book a cover it did not have.
 *
 * Books imported before covers existed have none. Re-reading every page of
 * them on upgrade would be a long wait for decoration, so the picture is drawn
 * later, once, and only page one is read.
 */
export async function setBookCover(bookId: number, cover: string): Promise<string | null> {
  try {
    const file = new File(booksDirectory(), `${bookId}.cover.jpg`);
    file.create({ overwrite: true });
    file.write(Uint8Array.from(atob(cover), (c) => c.charCodeAt(0)));

    const db = await database();
    await db.runAsync('UPDATE books SET cover_path = ? WHERE id = ?', file.uri, bookId);
    return file.uri;
  } catch {
    // Decoration, again. A book without a picture still reads.
    return null;
  }
}

/** Records a contents page, including the fact that a book has none. */
export async function setBookOutline(
  bookId: number,
  outline: OutlineEntry[],
): Promise<void> {
  const db = await database();
  await db.runAsync('UPDATE books SET outline = ? WHERE id = ?', JSON.stringify(outline), bookId);
}

/**
 * Books still missing a picture or a contents page.
 *
 * Both are read in one pass, so a book that needs either is opened once
 * rather than twice.
 */
export async function booksNeedingDetails(): Promise<Book[]> {
  const db = await database();
  const rows = await db.getAllAsync<BookRow>(
    `${SELECT} WHERE b.cover_path IS NULL OR b.outline IS NULL`,
  );
  return rows.map(toBook);
}

/**
 * Renames a book.
 *
 * Needed because a title is sometimes a guess: a PDF opened from a file
 * manager arrives as a uri, and some providers hand over an id rather than a
 * name. Being able to fix it is what makes a plain fallback acceptable.
 */
export async function renameBook(bookId: number, title: string): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;
  const db = await database();
  await db.runAsync('UPDATE books SET title = ? WHERE id = ?', trimmed, bookId);
}

export async function deleteBook(bookId: number): Promise<void> {
  const book = await getBook(bookId);
  const db = await database();
  await db.runAsync('DELETE FROM positions WHERE book_id = ?', bookId);
  await db.runAsync('DELETE FROM books WHERE id = ?', bookId);

  // Its synthesised audio goes too. Filed under the book's own id, so this is
  // one folder rather than a hunt through names that say only which sentence.
  try {
    const synth = new Directory(Paths.cache, 'synth');
    const mine = new Directory(bookDirectory(`${synth.uri}/`, bookId));
    if (mine.exists) mine.delete();
  } catch {
    // The cache is the operating system's to reclaim in the end.
  }

  // The row is gone either way; a file left behind would only waste space.
  if (book) {
    for (const path of [book.uri, book.sentencesPath, book.coverPath ?? '']) {
      if (!path) continue;
      const file = new File(path);
      if (file.exists) file.delete();
    }
  }
}
