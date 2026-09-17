import type { SQLiteDatabase } from 'expo-sqlite';

// Parent tables first: this is the insert order on restore (and reverse is the delete order).
const TABLES = [
  'people',
  'expense_groups',
  'group_members',
  'expenses',
  'expense_payers',
  'expense_splits',
  'loans',
  'loan_repayments',
  'payments',
  'fund_entries',
] as const;

type Row = Record<string, string | number | null>;

export type Backup = {
  app: 'split-and-due';
  schemaVersion: number;
  exportedAt: string;
  tables: Record<(typeof TABLES)[number], Row[]>;
};

async function schemaVersion(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export async function exportBackup(db: SQLiteDatabase): Promise<Backup> {
  const tables = {} as Backup['tables'];
  for (const table of TABLES) {
    tables[table] = await db.getAllAsync<Row>(`SELECT * FROM ${table}`);
  }
  return {
    app: 'split-and-due',
    schemaVersion: await schemaVersion(db),
    exportedAt: new Date().toISOString(),
    tables,
  };
}

export async function parseBackup(db: SQLiteDatabase, text: string): Promise<Backup> {
  let data: Backup;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not a valid backup.');
  }
  if (data?.app !== 'split-and-due' || typeof data.tables !== 'object') {
    throw new Error('This file is not a Split & Due backup.');
  }
  if (data.schemaVersion > (await schemaVersion(db))) {
    throw new Error('This backup was made by a newer version of the app. Please update the app first.');
  }
  if (!data.tables.people?.some((p) => p.is_me === 1)) {
    throw new Error('This backup has no profile in it.');
  }
  // Backups from before multi-payer expenses: every expense had exactly one payer.
  if (data.schemaVersion < 2) {
    data.tables.expense_payers = (data.tables.expenses ?? []).map((e) => ({
      expense_id: e.id,
      person_id: e.paid_by,
      amount: e.amount,
    }));
  }
  // Backups from before the event fund: person-to-person "contributions" become fund entries.
  if (data.schemaVersion < 3) {
    const payments = data.tables.payments ?? [];
    data.tables.fund_entries = payments
      .filter((p) => p.kind === 'contribution')
      .map((p) => ({
        id: p.id,
        group_id: p.group_id,
        person_id: p.from_person,
        kind: 'contribution',
        amount: p.amount,
        date: p.date,
        note: p.note,
        created_at: p.created_at,
      }));
    data.tables.payments = payments.filter((p) => p.kind !== 'contribution');
  }
  return data;
}

/** Replaces ALL local data with the backup's contents. */
export async function restoreBackup(db: SQLiteDatabase, backup: Backup) {
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const table of [...TABLES].reverse()) {
      await tx.runAsync(`DELETE FROM ${table}`);
    }
    for (const table of TABLES) {
      const known = new Set(
        (await tx.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name)
      );
      for (const row of backup.tables[table] ?? []) {
        // Skip columns that no longer exist (older backups); names come from the file,
        // so only table columns are ever put into the SQL.
        const columns = Object.keys(row).filter((c) => known.has(c));
        await tx.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          columns.map((c) => row[c])
        );
      }
    }
  });
}
