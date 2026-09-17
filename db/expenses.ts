import type { SQLiteDatabase } from 'expo-sqlite';

import type { Expense, ExpenseSplit, SplitType } from './types';

export type ExpenseInput = {
  groupId: number;
  title: string;
  amount: number;
  paidBy: number;
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
  return { expense, splits };
}

/** Inserts (id undefined) or replaces an expense together with its splits. */
export async function saveExpense(db: SQLiteDatabase, input: ExpenseInput, id?: number) {
  const shareSum = input.splits.reduce((sum, s) => sum + s.share, 0);
  if (shareSum !== input.amount) throw new Error('Shares must add up to the total amount.');

  await db.withExclusiveTransactionAsync(async (tx) => {
    let expenseId = id;
    if (expenseId == null) {
      const result = await tx.runAsync(
        `INSERT INTO expenses (group_id, title, amount, paid_by, split_type, date, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        input.groupId,
        input.title,
        input.amount,
        input.paidBy,
        input.splitType,
        input.date,
        input.note,
        Date.now()
      );
      expenseId = result.lastInsertRowId;
    } else {
      await tx.runAsync(
        `UPDATE expenses SET title = ?, amount = ?, paid_by = ?, split_type = ?, date = ?, note = ?
         WHERE id = ?`,
        input.title,
        input.amount,
        input.paidBy,
        input.splitType,
        input.date,
        input.note,
        expenseId
      );
      await tx.runAsync('DELETE FROM expense_splits WHERE expense_id = ?', expenseId);
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
