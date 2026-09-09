import { database } from './connection';

export interface Group {
  id: number;
  name: string;
  /** How many books are in it, so the chip can say so without a second query. */
  count: number;
}

/**
 * Groups a reader makes for themselves.
 *
 * A book belongs to any number of them, or to none. That is the whole reason
 * for the join table: with a column on the book instead, every book would have
 * to be in exactly one group and "ungrouped" would become a group of its own.
 */
export async function listGroups(): Promise<Group[]> {
  const db = await database();
  return db.getAllAsync<Group>(`
    SELECT g.id, g.name, COUNT(bg.book_id) AS count
    FROM groups g
    LEFT JOIN book_groups bg ON bg.group_id = g.id
    GROUP BY g.id
    ORDER BY g.name COLLATE NOCASE
  `);
}

/** Returns the existing group when the name is taken, rather than a duplicate. */
export async function createGroup(name: string): Promise<number> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('A group needs a name.');

  const db = await database();
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM groups WHERE name = ? COLLATE NOCASE',
    trimmed,
  );
  if (existing) return existing.id;

  const result = await db.runAsync(
    'INSERT INTO groups (name, created_at) VALUES (?, ?)',
    trimmed,
    Date.now(),
  );
  return result.lastInsertRowId;
}

/** Removes the group, not the books in it. */
export async function deleteGroup(groupId: number): Promise<void> {
  const db = await database();
  await db.runAsync('DELETE FROM groups WHERE id = ?', groupId);
}

export async function groupsOf(bookId: number): Promise<number[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ group_id: number }>(
    'SELECT group_id FROM book_groups WHERE book_id = ?',
    bookId,
  );
  return rows.map((row) => row.group_id);
}

export async function setBookGroup(
  bookId: number,
  groupId: number,
  member: boolean,
): Promise<void> {
  const db = await database();
  if (member) {
    // Adding a book already in the group is not an error, it is a no-op.
    await db.runAsync(
      'INSERT OR IGNORE INTO book_groups (book_id, group_id) VALUES (?, ?)',
      bookId,
      groupId,
    );
  } else {
    await db.runAsync(
      'DELETE FROM book_groups WHERE book_id = ? AND group_id = ?',
      bookId,
      groupId,
    );
  }
}

/** The ids in one group, for filtering a library that is already in memory. */
export async function bookIdsIn(groupId: number): Promise<number[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ book_id: number }>(
    'SELECT book_id FROM book_groups WHERE group_id = ?',
    groupId,
  );
  return rows.map((row) => row.book_id);
}
