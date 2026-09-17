import type { SQLiteDatabase } from 'expo-sqlite';

import { migrations } from './migrations';

export const DATABASE_NAME = 'split-and-due.db';

/**
 * Runs on every app start (SQLiteProvider `onInit`).
 * Applies pending migrations in order, tracking progress with `PRAGMA user_version`.
 */
export async function initDatabase(db: SQLiteDatabase) {
  // Per-connection settings: must run every time the database is opened.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;

    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(migration.sql);
      // PRAGMA doesn't accept bound parameters; version is a trusted integer.
      await tx.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    currentVersion = migration.version;
  }
}
