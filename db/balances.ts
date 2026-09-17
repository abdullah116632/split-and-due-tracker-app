import type { SQLiteDatabase } from 'expo-sqlite';

import { simplifyDebts } from '@/lib/settle';

import type { Nets } from './types';

type Row = { group_id: number; person_id: number; amount: number };

/**
 * Net balance of every member in every group (positive = should receive).
 * net = paid for expenses − own shares + payments sent − payments received
 */
export async function getAllGroupNets(db: SQLiteDatabase): Promise<Record<number, Nets>> {
  const rows = await db.getAllAsync<Row>(`
    SELECT group_id, person_id, 0 AS amount FROM group_members
    UNION ALL
    SELECT group_id, paid_by, amount FROM expenses
    UNION ALL
    SELECT e.group_id, s.person_id, -s.share FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
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
     SELECT to_person, amount FROM payments WHERE group_id IS NULL AND from_person = $me
     UNION ALL
     SELECT from_person, -amount FROM payments WHERE group_id IS NULL AND to_person = $me`,
    { $me: meId }
  );
  const nets: Nets = {};
  for (const r of rows) nets[r.person_id] = (nets[r.person_id] ?? 0) + r.amount;
  return nets;
}

/**
 * What each contact owes me (positive) or I owe them (negative) inside each group,
 * based on the simplified settle-up plan. Keyed by person id, then group id.
 */
export function pairwiseGroupBalances(
  allNets: Record<number, Nets>,
  meId: number
): Record<number, Record<number, number>> {
  const result: Record<number, Record<number, number>> = {};
  for (const [groupId, nets] of Object.entries(allNets)) {
    for (const t of simplifyDebts(nets)) {
      if (t.to === meId) {
        (result[t.from] ??= {})[Number(groupId)] = t.amount;
      } else if (t.from === meId) {
        (result[t.to] ??= {})[Number(groupId)] = -t.amount;
      }
    }
  }
  return result;
}

export type Overview = {
  personal: Nets;
  groupNets: Record<number, Nets>;
  pairwise: Record<number, Record<number, number>>;
  /** Total per contact: personal + all groups. */
  totals: Nets;
  toReceive: number;
  toPay: number;
};

export async function getOverview(db: SQLiteDatabase, meId: number): Promise<Overview> {
  const [personal, groupNets] = await Promise.all([
    getPersonalBalances(db, meId),
    getAllGroupNets(db),
  ]);
  const pairwise = pairwiseGroupBalances(groupNets, meId);

  const totals: Nets = { ...personal };
  for (const [personId, byGroup] of Object.entries(pairwise)) {
    for (const amount of Object.values(byGroup)) {
      totals[Number(personId)] = (totals[Number(personId)] ?? 0) + amount;
    }
  }

  let toReceive = 0;
  let toPay = 0;
  for (const amount of Object.values(totals)) {
    if (amount > 0) toReceive += amount;
    else toPay -= amount;
  }
  return { personal, groupNets, pairwise, totals, toReceive, toPay };
}
