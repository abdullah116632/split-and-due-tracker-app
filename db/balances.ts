import type { SQLiteDatabase } from 'expo-sqlite';

import { FUND_ID, type Nets } from './types';

type Row = { group_id: number; person_id: number; amount: number };

/**
 * Net balance of every member in every event (positive = should receive).
 *   person: paid out of pocket + put into fund − taken from fund − own shares + payments sent − received
 *   fund (FUND_ID): spent from fund − put into fund + taken from fund  (= minus the cash left in it)
 * A negative fund net means the fund still holds money that belongs to people.
 */
export async function getAllGroupNets(db: SQLiteDatabase): Promise<Record<number, Nets>> {
  const rows = await db.getAllAsync<Row>(`
    SELECT group_id, person_id, 0 AS amount FROM group_members
    UNION ALL
    SELECT e.group_id, p.person_id, p.amount FROM expense_payers p JOIN expenses e ON e.id = p.expense_id
    UNION ALL
    SELECT e.group_id, s.person_id, -s.share FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
    UNION ALL
    SELECT group_id, ${FUND_ID}, fund_amount FROM expenses WHERE fund_amount > 0
    UNION ALL
    SELECT group_id, person_id, CASE kind WHEN 'contribution' THEN amount ELSE -amount END FROM fund_entries
    UNION ALL
    SELECT group_id, ${FUND_ID}, CASE kind WHEN 'contribution' THEN -amount ELSE amount END FROM fund_entries
    UNION ALL
    SELECT group_id, from_person, amount FROM payments WHERE group_id IS NOT NULL
    UNION ALL
    SELECT group_id, to_person, -amount FROM payments WHERE group_id IS NOT NULL
  `);
  const result: Record<number, Nets> = {};
  for (const r of rows) {
    const nets = (result[r.group_id] ??= {});
    nets[r.person_id] = (nets[r.person_id] ?? 0) + r.amount;
  }
  return result;
}

export async function getGroupNets(db: SQLiteDatabase, groupId: number): Promise<Nets> {
  const all = await getAllGroupNets(db);
  return all[groupId] ?? {};
}

/** Personal (non-group) balance with each contact. Positive = they owe me. */
export async function getPersonalBalances(db: SQLiteDatabase, meId: number): Promise<Nets> {
  const rows = await db.getAllAsync<{ person_id: number; amount: number }>(
    `SELECT person_id, CASE direction WHEN 'lent' THEN amount ELSE -amount END AS amount FROM loans
     UNION ALL
     SELECT l.person_id, CASE l.direction WHEN 'lent' THEN -r.amount ELSE r.amount END
     FROM loan_repayments r JOIN loans l ON l.id = r.loan_id
     UNION ALL
     SELECT to_person, amount FROM payments WHERE group_id IS NULL AND from_person = $me
     UNION ALL
     SELECT from_person, -amount FROM payments WHERE group_id IS NULL AND to_person = $me`,
    { $me: meId }
  );
  const nets: Nets = {};
  for (const r of rows) nets[r.person_id] = (nets[r.person_id] ?? 0) + r.amount;
  return nets;
}

export type Overview = {
  /** Personal (non-event) balance with each contact. Positive = they owe me. */
  personal: Nets;
  /** My net in each event I'm part of. Positive = I get money back from the event. */
  myEventNets: Record<number, number>;
  toReceive: number;
  toPay: number;
};

/**
 * Event money is settled with the event (through its fund), not person to person,
 * so event balances are never split into "who owes whom".
 */
export async function getOverview(db: SQLiteDatabase, meId: number): Promise<Overview> {
  const [personal, groupNets] = await Promise.all([
    getPersonalBalances(db, meId),
    getAllGroupNets(db),
  ]);
  const myEventNets: Record<number, number> = {};
  for (const [groupId, nets] of Object.entries(groupNets)) {
    if (meId in nets) myEventNets[Number(groupId)] = nets[meId];
  }

  let toReceive = 0;
  let toPay = 0;
  for (const amount of [...Object.values(personal), ...Object.values(myEventNets)]) {
    if (amount > 0) toReceive += amount;
    else toPay -= amount;
  }
  return { personal, myEventNets, toReceive, toPay };
}
