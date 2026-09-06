import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { migrate } from './schema';

let opening: Promise<SQLiteDatabase> | null = null;

/** One connection for the app, migrated once, shared by every caller. */
export async function database(): Promise<SQLiteDatabase> {
  opening ??= openDatabaseAsync('papervoice.db').then(async (db) => {
    await migrate(db);
    return db;
  });
  return opening;
}
