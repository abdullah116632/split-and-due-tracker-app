import type { SQLiteDatabase } from 'expo-sqlite';

import type { FundEntryKind, LoanDirection } from './types';

/** One row of the unified timeline. */
export type ActivityItem = {
  kind: 'expense' | 'loan' | 'repayment' | 'payment' | 'fund';
  id: number;
  /** Expense title or note. */
  title: string | null;
  amount: number;
  date: string;
  created_at: number;
  group_id: number | null;
  group_name: string | null;
  /** Main payer (expense; null if paid only from the fund), contact (loan),
   *  sender (payment) or contributor (fund). */
  person_id: number | null;
  person_name: string | null;
  person_is_me: number | null;
  /** Receiver (payment only). */
  other_id: number | null;
  other_name: string | null;
  other_is_me: number | null;
  direction: LoanDirection | null;
  due_date: string | null;
  /** Expense only: how many people paid out of pocket. */
  payer_count: number | null;
  /** Expense only: part paid from the event fund. */
  fund_amount: number | null;
  fund_kind: FundEntryKind | null;
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
        NULL AS direction, NULL AS due_date,
        (SELECT COUNT(*) FROM expense_payers x WHERE x.expense_id = e.id) AS payer_count,
        e.fund_amount AS fund_amount,
        NULL AS fund_kind
      FROM expenses e
      JOIN expense_groups g ON g.id = e.group_id
      LEFT JOIN people p ON p.id = (
        SELECT x.person_id FROM expense_payers x WHERE x.expense_id = e.id
        ORDER BY x.amount DESC, x.person_id LIMIT 1
      )
      WHERE ($group IS NULL OR e.group_id = $group)`);
    parts.push(`
      SELECT 'fund' AS kind, f.id, f.note AS title, f.amount, f.date, f.created_at,
        g.id AS group_id, g.name AS group_name,
        p.id AS person_id, p.name AS person_name, p.is_me AS person_is_me,
        NULL AS other_id, NULL AS other_name, NULL AS other_is_me,
        NULL AS direction, NULL AS due_date,
        NULL AS payer_count, NULL AS fund_amount, f.kind AS fund_kind
      FROM fund_entries f
      JOIN expense_groups g ON g.id = f.group_id
      JOIN people p ON p.id = f.person_id
      WHERE ($group IS NULL OR f.group_id = $group)`);
  }
  if (includePersonal) {
    parts.push(`
      SELECT 'loan' AS kind, l.id, l.note AS title, l.amount, l.date, l.created_at,
        NULL AS group_id, NULL AS group_name,
        p.id AS person_id, p.name AS person_name, p.is_me AS person_is_me,
        NULL AS other_id, NULL AS other_name, NULL AS other_is_me,
        l.direction, l.due_date,
        NULL AS payer_count, NULL AS fund_amount, NULL AS fund_kind
      FROM loans l
      JOIN people p ON p.id = l.person_id
      WHERE ($person IS NULL OR l.person_id = $person)`);
    parts.push(`
      SELECT 'repayment' AS kind, r.id, r.note AS title, r.amount, r.date, r.created_at,
        NULL AS group_id, NULL AS group_name,
        p.id AS person_id, p.name AS person_name, p.is_me AS person_is_me,
        NULL AS other_id, NULL AS other_name, NULL AS other_is_me,
        l.direction, NULL AS due_date,
        NULL AS payer_count, NULL AS fund_amount, NULL AS fund_kind
      FROM loan_repayments r
      JOIN loans l ON l.id = r.loan_id
      JOIN people p ON p.id = l.person_id
      WHERE ($person IS NULL OR l.person_id = $person)`);
  }
  parts.push(`
    SELECT 'payment' AS kind, py.id, py.note AS title, py.amount, py.date, py.created_at,
      g.id AS group_id, g.name AS group_name,
      pf.id AS person_id, pf.name AS person_name, pf.is_me AS person_is_me,
      pt.id AS other_id, pt.name AS other_name, pt.is_me AS other_is_me,
      NULL AS direction, NULL AS due_date,
      NULL AS payer_count, NULL AS fund_amount, NULL AS fund_kind
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
