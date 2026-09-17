import type { SQLiteDatabase } from 'expo-sqlite';

import type { Group, Person } from './types';

export type GroupListItem = Group & { member_count: number; total_spent: number };

export function listGroups(db: SQLiteDatabase) {
  return db.getAllAsync<GroupListItem>(`
    SELECT g.*,
      (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count,
      (SELECT COALESCE(SUM(amount), 0) FROM expenses e WHERE e.group_id = g.id) AS total_spent
    FROM expense_groups g
    ORDER BY g.created_at DESC
  `);
}

export function getGroup(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<GroupListItem>(
    `SELECT g.*,
      (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count,
      (SELECT COALESCE(SUM(amount), 0) FROM expenses e WHERE e.group_id = g.id) AS total_spent
     FROM expense_groups g WHERE g.id = ?`,
    id
  );
}

/** Members with "me" first, then alphabetical. */
export function getGroupMembers(db: SQLiteDatabase, groupId: number) {
  return db.getAllAsync<Person>(
    `SELECT p.* FROM group_members m JOIN people p ON p.id = m.person_id
     WHERE m.group_id = ?
     ORDER BY p.is_me DESC, p.name COLLATE NOCASE`,
    groupId
  );
}

/** Whether a member has any expense, share or payment in the group. */
export async function isMemberInvolved(db: SQLiteDatabase, groupId: number, personId: number) {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT
       (SELECT COUNT(*) FROM expenses WHERE group_id = $g AND paid_by = $p)
     + (SELECT COUNT(*) FROM expense_splits s JOIN expenses e ON e.id = s.expense_id
          WHERE e.group_id = $g AND s.person_id = $p)
     + (SELECT COUNT(*) FROM payments WHERE group_id = $g AND (from_person = $p OR to_person = $p)) AS n`,
    { $g: groupId, $p: personId }
  );
  return (row?.n ?? 0) > 0;
}

export async function createGroup(db: SQLiteDatabase, name: string, memberIds: number[]) {
  let groupId = 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const result = await tx.runAsync(
      'INSERT INTO expense_groups (name, created_at) VALUES (?, ?)',
      name,
      Date.now()
    );
    groupId = result.lastInsertRowId;
    for (const personId of memberIds) {
      await tx.runAsync(
        'INSERT INTO group_members (group_id, person_id) VALUES (?, ?)',
        groupId,
        personId
      );
    }
  });
  return groupId;
}

/**
 * Renames the group and syncs its members. Throws if a member to be removed
 * still has records in the group.
 */
export async function updateGroup(
  db: SQLiteDatabase,
  groupId: number,
  name: string,
  memberIds: number[]
) {
  const current = (await getGroupMembers(db, groupId)).map((p) => p.id);
  const toRemove = current.filter((id) => !memberIds.includes(id));
  const toAdd = memberIds.filter((id) => !current.includes(id));

  for (const personId of toRemove) {
    if (await isMemberInvolved(db, groupId, personId)) {
      const person = await db.getFirstAsync<{ name: string }>(
        'SELECT name FROM people WHERE id = ?',
        personId
      );
      throw new Error(
        `${person?.name ?? 'This member'} has expenses or payments in this group and can't be removed.`
      );
    }
  }

  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE expense_groups SET name = ? WHERE id = ?', name, groupId);
    for (const personId of toRemove) {
      await tx.runAsync(
        'DELETE FROM group_members WHERE group_id = ? AND person_id = ?',
        groupId,
        personId
      );
    }
    for (const personId of toAdd) {
      await tx.runAsync(
        'INSERT INTO group_members (group_id, person_id) VALUES (?, ?)',
        groupId,
        personId
      );
    }
  });
}

export async function deleteGroup(db: SQLiteDatabase, groupId: number) {
  await db.runAsync('DELETE FROM expense_groups WHERE id = ?', groupId);
}

/** Groups a contact belongs to. */
export function listGroupsForPerson(db: SQLiteDatabase, personId: number) {
  return db.getAllAsync<Group>(
    `SELECT g.* FROM expense_groups g JOIN group_members m ON m.group_id = g.id
     WHERE m.person_id = ? ORDER BY g.created_at DESC`,
    personId
  );
}
