import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Bumped whenever the statements below change. The version lives in the
 * database itself, so an app that skipped a release still migrates in order.
 */
const SCHEMA_VERSION = 3;

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

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}
