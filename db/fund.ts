import type { SQLiteDatabase } from 'expo-sqlite';

import type { FundEntry, FundEntryKind } from './types';

export type FundEntryInput = {
  groupId: number;
  personId: number;
  kind: FundEntryKind;
  amount: number;
  date: string;
  note: string | null;
};

export function getFundEntry(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<FundEntry>('SELECT * FROM fund_entries WHERE id = ?', id);
}

export async function saveFundEntry(db: SQLiteDatabase, input: FundEntryInput, id?: number) {
  if (id == null) {
    await db.runAsync(
      `INSERT INTO fund_entries (group_id, person_id, kind, amount, date, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      input.groupId,
      input.personId,
      input.kind,
      input.amount,
      input.date,
      input.note,
      Date.now()
    );
  } else {
    await db.runAsync(
      'UPDATE fund_entries SET person_id = ?, kind = ?, amount = ?, date = ?, note = ? WHERE id = ?',
      input.personId,
      input.kind,
      input.amount,
      input.date,
      input.note,
      id
    );
  }
}

export async function deleteFundEntry(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM fund_entries WHERE id = ?', id);
}

export type FundSummary = {
  /** Cash put into the fund. */
  collected: number;
  /** Cash given back from the fund. */
  refunded: number;
  /** Expenses paid from the fund. */
  spentFromFund: number;
  /** Cash currently in the fund (can go negative if overspent). */
  balance: number;
  /** Per person: cash put in + paid out of pocket − refunds. */
  contributedBy: Record<number, number>;
  /** Per person: their share of all expenses. */
  shareOf: Record<number, number>;
  totalContributed: number;
};

export async function getFundSummary(db: SQLiteDatabase, groupId: number): Promise<FundSummary> {
  const totals = await db.getFirstAsync<{ collected: number; refunded: number; spent: number }>(
    `SELECT
       (SELECT COALESCE(SUM(amount), 0) FROM fund_entries WHERE group_id = $g AND kind = 'contribution') AS collected,
       (SELECT COALESCE(SUM(amount), 0) FROM fund_entries WHERE group_id = $g AND kind = 'refund') AS refunded,
       (SELECT COALESCE(SUM(fund_amount), 0) FROM expenses WHERE group_id = $g) AS spent`,
    { $g: groupId }
  );
  const contributions = await db.getAllAsync<{ person_id: number; amount: number }>(
    `SELECT person_id, SUM(amount) AS amount FROM (
       SELECT person_id, CASE kind WHEN 'contribution' THEN amount ELSE -amount END AS amount
       FROM fund_entries WHERE group_id = $g
       UNION ALL
       SELECT x.person_id, x.amount FROM expense_payers x JOIN expenses e ON e.id = x.expense_id
       WHERE e.group_id = $g
     ) GROUP BY person_id`,
    { $g: groupId }
  );
  const shares = await db.getAllAsync<{ person_id: number; amount: number }>(
    `SELECT s.person_id, SUM(s.share) AS amount FROM expense_splits s
     JOIN expenses e ON e.id = s.expense_id WHERE e.group_id = $g GROUP BY s.person_id`,
    { $g: groupId }
  );

  const collected = totals?.collected ?? 0;
  const refunded = totals?.refunded ?? 0;
  const spentFromFund = totals?.spent ?? 0;
  const contributedBy = Object.fromEntries(contributions.map((r) => [r.person_id, r.amount]));
  return {
    collected,
    refunded,
    spentFromFund,
    balance: collected - refunded - spentFromFund,
    contributedBy,
    shareOf: Object.fromEntries(shares.map((r) => [r.person_id, r.amount])),
    totalContributed: contributions.reduce((sum, r) => sum + r.amount, 0),
  };
}
