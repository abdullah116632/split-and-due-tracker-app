import type { SQLiteDatabase } from 'expo-sqlite';

import type { Expense, ExpensePayer, ExpenseSplit, SplitType } from './types';

export type ExpenseInput = {
  groupId: number;
  title: string;
  amount: number;
  /** People who paid out of pocket, and how much. */
  payers: { personId: number; amount: number }[];
  /** Part paid from the event fund. payers + fundAmount must equal amount. */
  fundAmount: number;
  splitType: SplitType;
  date: string;
  note: string | null;
  splits: { personId: number; share: number; percent: number | null }[];
};

export async function getExpense(db: SQLiteDatabase, id: number) {
  const expense = await db.getFirstAsync<Expense>('SELECT * FROM expenses WHERE id = ?', id);
  if (!expense) return null;
  const splits = await db.getAllAsync<ExpenseSplit>(
    'SELECT * FROM expense_splits WHERE expense_id = ?',
    id
  );
  const payers = await db.getAllAsync<ExpensePayer>(
    'SELECT * FROM expense_payers WHERE expense_id = ?',
    id
  );
  return { expense, splits, payers };
}

/** Inserts (id undefined) or replaces an expense together with its splits. */
export async function saveExpense(db: SQLiteDatabase, input: ExpenseInput, id?: number) {
  const shareSum = input.splits.reduce((sum, s) => sum + s.share, 0);
  if (shareSum !== input.amount) throw new Error('Shares must add up to the total amount.');
  const paidSum = input.payers.reduce((sum, p) => sum + p.amount, 0) + input.fundAmount;
  if (paidSum !== input.amount || input.fundAmount < 0 || input.payers.some((p) => p.amount <= 0)) {
    throw new Error('Amounts paid must add up to the total amount.');
  }

  await db.withExclusiveTransactionAsync(async (tx) => {
    let expenseId = id;
    if (expenseId == null) {
      const result = await tx.runAsync(
        `INSERT INTO expenses (group_id, title, amount, fund_amount, split_type, date, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        input.groupId,
        input.title,
        input.amount,
        input.fundAmount,
        input.splitType,
        input.date,
        input.note,
        Date.now()
      );
      expenseId = result.lastInsertRowId;
    } else {
      await tx.runAsync(
        `UPDATE expenses SET title = ?, amount = ?, fund_amount = ?, split_type = ?, date = ?, note = ?
         WHERE id = ?`,
        input.title,
        input.amount,
        input.fundAmount,
        input.splitType,
        input.date,
        input.note,
        expenseId
      );
      await tx.runAsync('DELETE FROM expense_splits WHERE expense_id = ?', expenseId);
      await tx.runAsync('DELETE FROM expense_payers WHERE expense_id = ?', expenseId);
    }
    for (const p of input.payers) {
      await tx.runAsync(
        'INSERT INTO expense_payers (expense_id, person_id, amount) VALUES (?, ?, ?)',
        expenseId,
        p.personId,
        p.amount
      );
    }
    for (const s of input.splits) {
      await tx.runAsync(
        'INSERT INTO expense_splits (expense_id, person_id, share, percent) VALUES (?, ?, ?, ?)',
        expenseId,
        s.personId,
        s.share,
        s.percent
      );
    }
  });
}

export async function deleteExpense(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
}
