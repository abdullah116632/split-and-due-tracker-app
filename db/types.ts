export type Person = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  is_me: number;
  created_at: number;
};

export type Group = {
  id: number;
  name: string;
  created_at: number;
};

export type SplitType = 'equal' | 'exact' | 'percent';

export type Expense = {
  id: number;
  group_id: number;
  title: string;
  amount: number;
  /** Part of the amount paid from the event fund; the rest is in expense_payers. */
  fund_amount: number;
  split_type: SplitType;
  date: string;
  note: string | null;
  created_at: number;
};

export type ExpensePayer = {
  expense_id: number;
  person_id: number;
  amount: number;
};

export type ExpenseSplit = {
  expense_id: number;
  person_id: number;
  share: number;
  percent: number | null;
};

export type LoanDirection = 'lent' | 'borrowed';

export type Loan = {
  id: number;
  person_id: number;
  direction: LoanDirection;
  amount: number;
  note: string | null;
  date: string;
  due_date: string | null;
  /** When to show a reminder notification (epoch ms). */
  reminder_at: number | null;
  /** Id of the scheduled local notification, if any. */
  notification_id: string | null;
  created_at: number;
};

export type LoanRepayment = {
  id: number;
  loan_id: number;
  amount: number;
  date: string;
  note: string | null;
  created_at: number;
};

export type Payment = {
  id: number;
  group_id: number | null;
  from_person: number;
  to_person: number;
  amount: number;
  date: string;
  note: string | null;
  created_at: number;
};

export type FundEntryKind = 'contribution' | 'refund';

/** Money put into (contribution) or taken back from (refund) an event's fund. */
export type FundEntry = {
  id: number;
  group_id: number;
  person_id: number;
  kind: FundEntryKind;
  amount: number;
  date: string;
  note: string | null;
  created_at: number;
};

/** Pseudo person id used for the event fund inside net balances. */
export const FUND_ID = 0;

/** Net amounts keyed by person id (or FUND_ID). Positive = should receive. */
export type Nets = Record<number, number>;
