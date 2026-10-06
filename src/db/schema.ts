import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Bumped whenever the statements below change. The version lives in the
 * database itself, so an app that skipped a release still migrates in order.
 */
const SCHEMA_VERSION = 7;

/**
 * Creates or upgrades the library.
 *
 * A book's sentences are a JSON file on disk and only their path is stored
 * here: a long book is several megabytes of them, and keeping that out of the
 * database is what lets the library list stay quick.
 */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';

      CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        uri TEXT NOT NULL,
        sentences_path TEXT NOT NULL,
        page_count INTEGER NOT NULL,
        sentence_count INTEGER NOT NULL,
        added_at INTEGER NOT NULL,
        last_opened_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS positions (
        book_id INTEGER PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
        sentence_index INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  if (version < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  if (version < 3) {
    // Books imported before this have no cover and never will: the picture is
    // drawn during extraction, and re-running that for the whole library on
    // upgrade would be a long wait for decoration. They keep the placeholder.
    await db.execAsync(`ALTER TABLE books ADD COLUMN cover_path TEXT`);
  }

  if (version < 4) {
    // A book can sit in several groups, or none. The join table is what makes
    // "none" the natural default rather than a group everything starts in.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS book_groups (
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        PRIMARY KEY (book_id, group_id)
      );
    `);
  }

  if (version < 5) {
    // A contents page is a few kilobytes at most, so it lives in the row
    // rather than in a file of its own like the sentences do.
    await db.execAsync(`ALTER TABLE books ADD COLUMN outline TEXT`);
  }

  if (version < 6) {
    /*
     * What the file is, rather than where it came from.
     *
     * The same document imported twice made two books, because the only
     * identity a book had was its uri -- and a uri is about where a file was
     * picked from, not what it holds. The share sheet hands out a different
     * one each time, and the picker copies to a fresh cache name on every
     * import, so two uris for one document is the normal case rather than the
     * odd one.
     *
     * Null for everything imported before this. They cannot be filled in
     * afterwards -- the original PDF is not kept -- so an older book is simply
     * never recognised as a duplicate, which is the behaviour those books
     * already had.
     */
    await db.execAsync(`
      ALTER TABLE books ADD COLUMN content_hash TEXT;
      CREATE INDEX IF NOT EXISTS books_content_hash ON books(content_hash);
    `);
  }

  if (version < 7) {
    /*
     * When the last sentence last finished playing.
     *
     * Without it a finished book was indistinguishable from one paused near the
     * end: it stayed under "Continue listening" at a hundred percent, and
     * reopening it landed on its final sentence. Null for every existing book,
     * which is right -- none of them has been recorded as finished.
     */
    await db.execAsync(`ALTER TABLE books ADD COLUMN finished_at INTEGER`);
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);

  // Only when something changed, so it is one line per upgrade rather than one
  // per launch. A release build's database cannot be read over adb; this is
  // how an upgrade is confirmed on a real device.
  if (version !== SCHEMA_VERSION) {
    console.log(`[papervoice] library schema migrated ${version} -> ${SCHEMA_VERSION}`);
  }
}
