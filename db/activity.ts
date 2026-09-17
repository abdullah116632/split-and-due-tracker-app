import type { SQLiteDatabase } from 'expo-sqlite';

import type { LoanDirection } from './types';

/** One row of the unified timeline: an expense, a personal debt or a payment. */
export type ActivityItem = {
  kind: 'expense' | 'loan' | 'payment';
  id: number;
  /** Expense title or note. */
  title: string | null;
  amount: number;
  date: string;
  created_at: number;
  group_id: number | null;
  group_name: string | null;
  /** Payer (expense), contact (loan) or sender (payment). */
  person_id: number;
  person_name: string;
  person_is_me: number;
  /** Receiver (payment only). */
  other_id: number | null;
  other_name: string | null;
  other_is_me: number | null;
  direction: LoanDirection | null;
  due_date: string | null;
};

export type ActivityFilter = {
  groupId?: number;
  /** Only personal records (loans and non-group payments) with this contact. */
  personalWith?: number;
  scope?: 'all' | 'groups' | 'personal';
  limit?: number;
};

export function listActivity(db: SQLiteDatabase, filter: ActivityFilter = {}) {
  const { groupId, personalWith, scope = 'all', limit = 500 } = filter;
  const includeGroups = scope !== 'personal' && personalWith == null;
  const includePersonal = scope !== 'groups' && groupId == null;

  const parts: string[] = [];
  if (includeGroups) {
    parts.push(`
      SELECT 'expense' AS kind, e.id, e.title, e.amount, e.date, e.created_at,
        g.id AS group_id, g.name AS group_name,
        p.id AS person_id, p.name AS person_name, p.is_me AS person_is_me,
        NULL AS other_id, NULL AS other_name, NULL AS other_is_me,
        NULL AS direction, NULL AS due_date
      FROM expenses e
      JOIN expense_groups g ON g.id = e.group_id
      JOIN people p ON p.id = e.paid_by
      WHERE ($group IS NULL OR e.group_id = $group)`);
  }
  if (includePersonal) {
    parts.push(`
      SELECT 'loan' AS kind, l.id, l.note AS title, l.amount, l.date, l.created_at,
        NULL AS group_id, NULL AS group_name,
        p.id AS person_id, p.name AS person_name, p.is_me AS person_is_me,
        NULL AS other_id, NULL AS other_name, NULL AS other_is_me,
        l.direction, l.due_date
      FROM loans l
      JOIN people p ON p.id = l.person_id
      WHERE ($person IS NULL OR l.person_id = $person)`);
  }
  parts.push(`
    SELECT 'payment' AS kind, py.id, py.note AS title, py.amount, py.date, py.created_at,
      g.id AS group_id, g.name AS group_name,
      pf.id AS person_id, pf.name AS person_name, pf.is_me AS person_is_me,
      pt.id AS other_id, pt.name AS other_name, pt.is_me AS other_is_me,
      NULL AS direction, NULL AS due_date
    FROM payments py
    LEFT JOIN expense_groups g ON g.id = py.group_id
    JOIN people pf ON pf.id = py.from_person
    JOIN people pt ON pt.id = py.to_person
    WHERE ($group IS NULL OR py.group_id = $group)
      AND ($person IS NULL OR (py.group_id IS NULL AND (py.from_person = $person OR py.to_person = $person)))
      AND (${includeGroups ? '1' : 'py.group_id IS NULL'})
      AND (${includePersonal ? '1' : 'py.group_id IS NOT NULL'})`);

  const sql = `SELECT * FROM (${parts.join(' UNION ALL ')}) ORDER BY date DESC, created_at DESC LIMIT $limit`;
  return db.getAllAsync<ActivityItem>(sql, {
    $group: groupId ?? null,
    $person: personalWith ?? null,
    $limit: limit,
  });
}
