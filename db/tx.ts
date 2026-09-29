import type { SQLiteDatabase } from 'expo-sqlite';

let queue: Promise<unknown> = Promise.resolve();

/**
 * Runs `task` inside a transaction on the app's main connection.
 *
 * expo-sqlite's withExclusiveTransactionAsync opens a separate connection, where our
 * per-connection settings (foreign keys, cascades) are off — so we don't use it.
 * Transactions are queued so two saves can never nest.
 */
export function inTransaction(db: SQLiteDatabase, task: (tx: SQLiteDatabase) => Promise<void>) {
  const run = async () => {
    await db.execAsync('BEGIN IMMEDIATE');
    try {
      await task(db);
      await db.execAsync('COMMIT');
    } catch (e) {
      await db.execAsync('ROLLBACK');
      throw e;
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}
