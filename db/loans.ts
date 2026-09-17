import type { SQLiteDatabase } from 'expo-sqlite';

import type { Loan, LoanDirection, LoanRepayment } from './types';

export type LoanInput = {
  personId: number;
  direction: LoanDirection;
  amount: number;
  note: string | null;
  date: string;
  dueDate: string | null;
  reminderAt: number | null;
};

/** A debt with how much has been returned so far. */
export type LoanWithStatus = Loan & {
  person_name: string;
  repaid: number;
  remaining: number;
};

const WITH_STATUS = `
  SELECT l.*, p.name AS person_name,
    COALESCE((SELECT SUM(r.amount) FROM loan_repayments r WHERE r.loan_id = l.id), 0) AS repaid,
    l.amount - COALESCE((SELECT SUM(r.amount) FROM loan_repayments r WHERE r.loan_id = l.id), 0) AS remaining
  FROM loans l JOIN people p ON p.id = l.person_id`;

export function getLoan(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<LoanWithStatus>(`${WITH_STATUS} WHERE l.id = ?`, id);
}

/** Open debts first (soonest due first), then returned ones (newest first). */
export function listLoans(db: SQLiteDatabase, direction?: LoanDirection) {
  return db.getAllAsync<LoanWithStatus>(
    `SELECT * FROM (${WITH_STATUS}) WHERE ($dir IS NULL OR direction = $dir)
     ORDER BY remaining = 0,
       CASE WHEN remaining > 0 THEN COALESCE(due_date, '9999-12-31') END,
       date DESC, id DESC`,
    { $dir: direction ?? null }
  );
}

/** Open debts that have a due date, soonest first. */
export function listOpenLoansWithDueDate(db: SQLiteDatabase) {
  return db.getAllAsync<LoanWithStatus>(
    `SELECT * FROM (${WITH_STATUS})
     WHERE due_date IS NOT NULL AND remaining > 0
     ORDER BY due_date, id`
  );
}

export async function saveLoan(db: SQLiteDatabase, input: LoanInput, id?: number) {
  if (id == null) {
    const result = await db.runAsync(
      `INSERT INTO loans (person_id, direction, amount, note, date, due_date, reminder_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      input.personId,
      input.direction,
      input.amount,
      input.note,
      input.date,
      input.dueDate,
      input.reminderAt,
      Date.now()
    );
    return result.lastInsertRowId;
  }
  const existing = await getLoan(db, id);
  if (existing && input.amount < existing.repaid) {
    throw new Error('The amount can’t be less than what has already been returned.');
  }
  await db.runAsync(
    `UPDATE loans SET person_id = ?, direction = ?, amount = ?, note = ?, date = ?, due_date = ?,
       reminder_at = ?
     WHERE id = ?`,
    input.personId,
    input.direction,
    input.amount,
    input.note,
    input.date,
    input.dueDate,
    input.reminderAt,
    id
  );
  return id;
}

export async function setLoanNotificationId(db: SQLiteDatabase, id: number, notificationId: string | null) {
  await db.runAsync('UPDATE loans SET notification_id = ? WHERE id = ?', notificationId, id);
}

export async function deleteLoan(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM loans WHERE id = ?', id);
}

export type RepaymentInput = { loanId: number; amount: number; date: string; note: string | null };

export function getRepayment(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<LoanRepayment>('SELECT * FROM loan_repayments WHERE id = ?', id);
}

/** Records (or edits) a return. Can't return more than what is still owed. */
export async function saveRepayment(db: SQLiteDatabase, input: RepaymentInput, id?: number) {
  const loan = await getLoan(db, input.loanId);
  if (!loan) throw new Error('This debt no longer exists.');
  const previous = id != null ? ((await getRepayment(db, id))?.amount ?? 0) : 0;
  if (input.amount > loan.remaining + previous) {
    throw new Error('That is more than what is still owed.');
  }
  if (id == null) {
    await db.runAsync(
      'INSERT INTO loan_repayments (loan_id, amount, date, note, created_at) VALUES (?, ?, ?, ?, ?)',
      input.loanId,
      input.amount,
      input.date,
      input.note,
      Date.now()
    );
  } else {
    await db.runAsync(
      'UPDATE loan_repayments SET amount = ?, date = ?, note = ? WHERE id = ?',
      input.amount,
      input.date,
      input.note,
      id
    );
  }
}

export async function deleteRepayment(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM loan_repayments WHERE id = ?', id);
}

export function listRepayments(db: SQLiteDatabase, loanId: number) {
  return db.getAllAsync<LoanRepayment>(
    'SELECT * FROM loan_repayments WHERE loan_id = ? ORDER BY date DESC, id DESC',
    loanId
  );
}
