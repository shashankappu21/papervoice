import { Directory, File, Paths } from 'expo-file-system';
import { database } from './connection';
import type { ExtractedDoc, Sentence } from '../extraction/types';

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

  const sentences = new File(dir, `${stamp}.sentences.json`);
  // overwrite: a file object has no idempotent flag, and create() throws on a
  // name that is already taken.
  sentences.create({ overwrite: true });
  sentences.write(JSON.stringify(doc.sentences));

  const db = await database();
  const result = await db.runAsync(
    `INSERT INTO books (title, uri, sentences_path, page_count, sentence_count, added_at, last_opened_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    title,
    pdf.uri,
    sentences.uri,
    doc.pageCount,
    doc.sentences.length,
    stamp,
    stamp,
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
});

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

export async function deleteBook(bookId: number): Promise<void> {
  const book = await getBook(bookId);
  const db = await database();
  await db.runAsync('DELETE FROM positions WHERE book_id = ?', bookId);
  await db.runAsync('DELETE FROM books WHERE id = ?', bookId);

  // The row is gone either way; a file left behind would only waste space.
  if (book) {
    for (const path of [book.uri, book.sentencesPath]) {
      const file = new File(path);
      if (file.exists) file.delete();
    }
  }
}
