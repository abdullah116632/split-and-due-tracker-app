export type Migration = {
  /** Must be unique and increasing. Never edit a migration once it has shipped — add a new one. */
  version: number;
  sql: string;
  /** Set when the SQL drops/recreates tables; runs with foreign keys temporarily off. */
  rebuildsTables?: boolean;
};

export const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        is_me INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      -- Only one "me" person can exist.
      CREATE UNIQUE INDEX people_single_me ON people(is_me) WHERE is_me = 1;

      CREATE TABLE expense_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE group_members (
        group_id INTEGER NOT NULL REFERENCES expense_groups(id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
        PRIMARY KEY (group_id, person_id)
      );

      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES expense_groups(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        amount INTEGER NOT NULL CHECK (amount > 0),
        paid_by INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
        split_type TEXT NOT NULL CHECK (split_type IN ('equal', 'exact', 'percent')),
        date TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX expenses_group ON expenses(group_id);

      -- share: how much of the expense this person owes (poisha).
      -- percent: the percentage entered for 'percent' splits, kept for editing.
      CREATE TABLE expense_splits (
        expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
        share INTEGER NOT NULL CHECK (share >= 0),
        percent REAL,
        PRIMARY KEY (expense_id, person_id)
      );
      CREATE INDEX expense_splits_person ON expense_splits(person_id);

      -- Personal 1-on-1 debts between me and a contact.
      CREATE TABLE loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
        direction TEXT NOT NULL CHECK (direction IN ('lent', 'borrowed')),
        amount INTEGER NOT NULL CHECK (amount > 0),
        note TEXT,
        date TEXT NOT NULL,
        due_date TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX loans_person ON loans(person_id);

      -- Settle-up payments. group_id NULL = personal payment between me and a contact.
      CREATE TABLE payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER REFERENCES expense_groups(id) ON DELETE CASCADE,
        from_person INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
        to_person INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
        amount INTEGER NOT NULL CHECK (amount > 0),
        date TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        CHECK (from_person <> to_person)
      );
      CREATE INDEX payments_group ON payments(group_id);
      CREATE INDEX payments_from ON payments(from_person);
      CREATE INDEX payments_to ON payments(to_person);
    `,
  },
  {
    version: 2,
    sql: `
      -- An expense can be paid by several people. expenses.paid_by is kept as the main
      -- (largest) payer for display; balances use this table.
      CREATE TABLE expense_payers (
        expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
        amount INTEGER NOT NULL CHECK (amount > 0),
        PRIMARY KEY (expense_id, person_id)
      );
      CREATE INDEX expense_payers_person ON expense_payers(person_id);
      INSERT INTO expense_payers (expense_id, person_id, amount)
        SELECT id, paid_by, amount FROM expenses;

      -- 'contribution' = money given into an event's fund (held by to_person).
      ALTER TABLE payments ADD COLUMN kind TEXT NOT NULL DEFAULT 'settlement'
        CHECK (kind IN ('settlement', 'contribution'));
    `,
  },
  {
    version: 3,
    rebuildsTables: true,
    sql: `
      -- Event fund: money people put into (or take back from) an event's shared pool.
      CREATE TABLE fund_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES expense_groups(id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
        kind TEXT NOT NULL CHECK (kind IN ('contribution', 'refund')),
        amount INTEGER NOT NULL CHECK (amount > 0),
        date TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX fund_entries_group ON fund_entries(group_id);
      CREATE INDEX fund_entries_person ON fund_entries(person_id);

      -- v2 "contributions" were person-to-person; they now go into the fund.
      INSERT INTO fund_entries (group_id, person_id, kind, amount, date, note, created_at)
        SELECT group_id, from_person, 'contribution', amount, date, note, created_at
        FROM payments WHERE kind = 'contribution';
      DELETE FROM payments WHERE kind = 'contribution';

      -- Rebuild expenses: drop paid_by (payers live in expense_payers) and add
      -- fund_amount, the part of the expense paid from the event fund.
      CREATE TABLE expenses_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES expense_groups(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        amount INTEGER NOT NULL CHECK (amount > 0),
        fund_amount INTEGER NOT NULL DEFAULT 0 CHECK (fund_amount >= 0 AND fund_amount <= amount),
        split_type TEXT NOT NULL CHECK (split_type IN ('equal', 'exact', 'percent')),
        date TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL
      );
      INSERT INTO expenses_new (id, group_id, title, amount, fund_amount, split_type, date, note, created_at)
        SELECT id, group_id, title, amount, 0, split_type, date, note, created_at FROM expenses;
      DROP TABLE expenses;
      ALTER TABLE expenses_new RENAME TO expenses;
      CREATE INDEX expenses_group ON expenses(group_id);
    `,
  },
  {
    version: 4,
    sql: `
      -- Money returned against a specific personal debt (full or partial).
      CREATE TABLE loan_repayments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL CHECK (amount > 0),
        date TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX loan_repayments_loan ON loan_repayments(loan_id);

      -- Optional reminder: when to notify (epoch ms) and the scheduled notification's id.
      ALTER TABLE loans ADD COLUMN reminder_at INTEGER;
      ALTER TABLE loans ADD COLUMN notification_id TEXT;
    `,
  },
];
