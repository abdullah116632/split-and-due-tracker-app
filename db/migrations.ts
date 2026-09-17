export type Migration = {
  /** Must be unique and increasing. Never edit a migration once it has shipped — add a new one. */
  version: number;
  sql: string;
};

export const migrations: Migration[] = [
  // Tables will be added here once the data model is finalized, e.g.:
  // { version: 1, sql: `CREATE TABLE people (...);` },
];
