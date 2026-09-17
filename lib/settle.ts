export type Transfer = { from: number; to: number; amount: number };

/**
 * Turns net balances (positive = should receive, negative = should pay)
 * into a short list of transfers that settles everyone. Greedy: biggest debtor pays biggest creditor.
 */
export function simplifyDebts(nets: Record<number, number>): Transfer[] {
  const byAmount = (a: { id: number; amt: number }, b: { id: number; amt: number }) =>
    b.amt - a.amt || a.id - b.id;
  const entries = Object.entries(nets).map(([id, amt]) => ({ id: Number(id), amt }));
  const creditors = entries.filter((e) => e.amt > 0).sort(byAmount);
  const debtors = entries
    .filter((e) => e.amt < 0)
    .map((e) => ({ id: e.id, amt: -e.amt }))
    .sort(byAmount);

  const transfers: Transfer[] = [];
  let c = 0;
  let d = 0;
  while (c < creditors.length && d < debtors.length) {
    const amount = Math.min(creditors[c].amt, debtors[d].amt);
    transfers.push({ from: debtors[d].id, to: creditors[c].id, amount });
    creditors[c].amt -= amount;
    debtors[d].amt -= amount;
    if (creditors[c].amt === 0) c++;
    if (debtors[d].amt === 0) d++;
  }
  return transfers;
}
