import type { SQLiteDatabase } from 'expo-sqlite';

import type { Loan, LoanDirection } from './types';

export type LoanInput = {
  personId: number;
  direction: LoanDirection;
  amount: number;
  note: string | null;
  date: string;
  dueDate: string | null;
};

export function getLoan(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Loan>('SELECT * FROM loans WHERE id = ?', id);
}

export async function saveLoan(db: SQLiteDatabase, input: LoanInput, id?: number) {
  if (id == null) {
    await db.runAsync(
      `INSERT INTO loans (person_id, direction, amount, note, date, due_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      input.personId,
      input.direction,
      input.amount,
      input.note,
      input.date,
      input.dueDate,
      Date.now()
    );
  } else {
    await db.runAsync(
      `UPDATE loans SET person_id = ?, direction = ?, amount = ?, note = ?, date = ?, due_date = ?
       WHERE id = ?`,
      input.personId,
      input.direction,
      input.amount,
      input.note,
      input.date,
      input.dueDate,
      id
    );
  }
}

export async function deleteLoan(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM loans WHERE id = ?', id);
}

export type LoanWithPerson = Loan & { person_name: string };

/** Debts that have a due date, soonest first. */
export function listLoansWithDueDate(db: SQLiteDatabase) {
  return db.getAllAsync<LoanWithPerson>(
    `SELECT l.*, p.name AS person_name FROM loans l JOIN people p ON p.id = l.person_id
     WHERE l.due_date IS NOT NULL ORDER BY l.due_date, l.id`
  );
}
