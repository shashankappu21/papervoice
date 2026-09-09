import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { migrate } from './schema';

let opening: Promise<SQLiteDatabase> | null = null;

/** One connection for the app, migrated once, shared by every caller. */
export async function database(): Promise<SQLiteDatabase> {
  opening ??= openDatabaseAsync('papervoice.db').then(async (db) => {
    // SQLite disables foreign keys by default and the setting is per
    // connection, so every ON DELETE CASCADE in the schema was decorative
    // until this line. It must run before any statement that relies on one.
    await db.execAsync('PRAGMA foreign_keys = ON');
    await migrate(db);
    return db;
  });
  return opening;
}
