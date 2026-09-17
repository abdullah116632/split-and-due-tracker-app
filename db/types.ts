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
  paid_by: number;
  split_type: SplitType;
  date: string;
  note: string | null;
  created_at: number;
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

/** Net amounts keyed by person id. Positive = should receive. */
export type Nets = Record<number, number>;
