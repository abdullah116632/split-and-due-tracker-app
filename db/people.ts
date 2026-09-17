import type { SQLiteDatabase } from 'expo-sqlite';

import type { Person } from './types';

export type PersonInput = { name: string; phone: string | null; email: string | null };

export function getMe(db: SQLiteDatabase) {
  return db.getFirstAsync<Person>('SELECT * FROM people WHERE is_me = 1');
}

export function getPerson(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Person>('SELECT * FROM people WHERE id = ?', id);
}

/** All contacts except "me", alphabetically. */
export function listContacts(db: SQLiteDatabase) {
  return db.getAllAsync<Person>(
    'SELECT * FROM people WHERE is_me = 0 ORDER BY name COLLATE NOCASE'
  );
}

export async function createPerson(db: SQLiteDatabase, input: PersonInput, isMe = false) {
  const result = await db.runAsync(
    'INSERT INTO people (name, phone, email, is_me, created_at) VALUES (?, ?, ?, ?, ?)',
    input.name,
    input.phone,
    input.email,
    isMe ? 1 : 0,
    Date.now()
  );
  return result.lastInsertRowId;
}

export async function updatePerson(db: SQLiteDatabase, id: number, input: PersonInput) {
  await db.runAsync(
    'UPDATE people SET name = ?, phone = ?, email = ? WHERE id = ?',
    input.name,
    input.phone,
    input.email,
    id
  );
}

/** A person can only be deleted when no group, debt or payment refers to them. */
export async function canDeletePerson(db: SQLiteDatabase, id: number) {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT
       (SELECT COUNT(*) FROM group_members WHERE person_id = $id)
     + (SELECT COUNT(*) FROM loans WHERE person_id = $id)
     + (SELECT COUNT(*) FROM payments WHERE from_person = $id OR to_person = $id) AS n`,
    { $id: id }
  );
  return (row?.n ?? 0) === 0;
}

export async function deletePerson(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM people WHERE id = ? AND is_me = 0', id);
}
