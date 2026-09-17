export type Migration = {
  /** Must be unique and increasing. Never edit a migration once it has shipped — add a new one. */
  version: number;
  sql: string;
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
];
