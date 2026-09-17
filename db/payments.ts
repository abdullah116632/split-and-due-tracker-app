import type { SQLiteDatabase } from 'expo-sqlite';

import type { Payment } from './types';

export type PaymentInput = {
  groupId: number | null;
  from: number;
  to: number;
  amount: number;
  date: string;
  note: string | null;
};

export function getPayment(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Payment>('SELECT * FROM payments WHERE id = ?', id);
}

export async function savePayment(db: SQLiteDatabase, input: PaymentInput, id?: number) {
  if (input.from === input.to) throw new Error('Payer and receiver must be different people.');
  if (id == null) {
    await db.runAsync(
      `INSERT INTO payments (group_id, from_person, to_person, amount, date, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      input.groupId,
      input.from,
      input.to,
      input.amount,
      input.date,
      input.note,
      Date.now()
    );
  } else {
    await db.runAsync(
      `UPDATE payments SET from_person = ?, to_person = ?, amount = ?, date = ?, note = ?
       WHERE id = ?`,
      input.from,
      input.to,
      input.amount,
      input.date,
      input.note,
      id
    );
  }
}

export async function deletePayment(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM payments WHERE id = ?', id);
}
