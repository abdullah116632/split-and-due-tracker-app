import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, Divider } from '@/components/ui/card';
import { Chip, ChipRow, SegmentedControl } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { FieldError, FieldLabel, MoneyField, TextField } from '@/components/ui/text-field';
import { deleteExpense, getExpense, saveExpense } from '@/db/expenses';
import { getFundSummary } from '@/db/fund';
import { getGroupMembers, listGroups } from '@/db/groups';
import { FUND_ID, type Person, type SplitType } from '@/db/types';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/colors';
import { todayISO } from '@/lib/date';
import { useRequiredMe } from '@/lib/me-context';
import { allocate, formatMoney, poishaToInput, toPoisha } from '@/lib/money';
import { useDbQuery } from '@/lib/use-db-query';

type ShareResult = {
  shares: Record<number, number>;
  percents: Record<number, number>;
  /** Why the split is not valid yet, if it isn't. */
  problem: string | null;
};

function computeShares(
  total: number | null,
  splitType: SplitType,
  memberIds: number[],
  included: number[],
  exact: Record<number, string>,
  percent: Record<number, string>
): ShareResult {
  const shares: Record<number, number> = {};
  const percents: Record<number, number> = {};
  if (total == null || total <= 0) return { shares, percents, problem: 'Enter the amount first.' };

  if (splitType === 'equal') {
    const ids = memberIds.filter((id) => included.includes(id));
    if (ids.length === 0) return { shares, percents, problem: 'Pick at least one person.' };
    allocate(total, ids.map(() => 1)).forEach((share, i) => (shares[ids[i]] = share));
    return { shares, percents, problem: null };
  }

  if (splitType === 'exact') {
    let sum = 0;
    for (const id of memberIds) {
      const raw = exact[id]?.trim();
      if (!raw) continue;
      const value = toPoisha(raw);
      if (value == null) return { shares, percents, problem: 'One of the amounts is not a valid number.' };
      if (value > 0) shares[id] = value;
      sum += value;
    }
    if (sum !== total) {
      const diff = total - sum;
      return {
        shares,
        percents,
        problem: diff > 0 ? `${formatMoney(diff)} left to assign` : `${formatMoney(-diff)} over the total`,
      };
    }
    return { shares, percents, problem: null };
  }

  // percent
  const ids: number[] = [];
  const weights: number[] = [];
  for (const id of memberIds) {
    const raw = percent[id]?.trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return { shares, percents, problem: 'One of the percentages is not valid.' };
    }
    if (value > 0) {
      ids.push(id);
      weights.push(value);
      percents[id] = value;
    }
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.001) {
    return { shares, percents, problem: `Percentages add up to ${+sum.toFixed(2)}%, not 100%` };
  }
  allocate(total, weights).forEach((share, i) => (shares[ids[i]] = share));
  return { shares, percents, problem: null };
}

/** personId FUND_ID stands for the event fund. */
type PayerResult = { payers: { personId: number; amount: number }[]; problem: string | null };

function computePayers(
  total: number | null,
  mode: 'single' | 'multiple',
  paidBy: number | null,
  memberIds: number[],
  amounts: Record<number, string>
): PayerResult {
  if (total == null || total <= 0) return { payers: [], problem: null };
  if (mode === 'single') {
    return paidBy == null
      ? { payers: [], problem: 'Who paid?' }
      : { payers: [{ personId: paidBy, amount: total }], problem: null };
  }
  const payers: PayerResult['payers'] = [];
  let sum = 0;
  for (const id of memberIds) {
    const raw = amounts[id]?.trim();
    if (!raw) continue;
    const value = toPoisha(raw);
    if (value == null) return { payers, problem: 'One of the paid amounts is not a valid number.' };
    if (value > 0) payers.push({ personId: id, amount: value });
    sum += value;
  }
  if (sum !== total) {
    const diff = total - sum;
    return {
      payers,
      problem: diff > 0 ? `${formatMoney(diff)} of the bill not paid by anyone yet` : `${formatMoney(-diff)} more than the total`,
    };
  }
  return { payers, problem: null };
}

/**
 * Add an expense (optionally for `?groupId=`), or edit one with `?id=`.
 * "Paid by" can be the event fund, one person, or several (fund included).
 */
export default function ExpenseForm() {
  const db = useSQLiteContext();
  const me = useRequiredMe();
  const colors = useColors();
  const params = useLocalSearchParams<{ id?: string; groupId?: string }>();
  const editId = params.id ? Number(params.id) : undefined;

  const [groupId, setGroupId] = useState<number | null>(params.groupId ? Number(params.groupId) : null);
  const [members, setMembers] = useState<Person[]>([]);
  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [paidBy, setPaidBy] = useState<number | null>(null);
  const [payMode, setPayMode] = useState<'single' | 'multiple'>('single');
  const [paidAmounts, setPaidAmounts] = useState<Record<number, string>>({});
  /** Money in the fund, not counting this expense's own fund part (when editing). */
  const [fundAvailable, setFundAvailable] = useState<number | null>(null);
  const [originalFundAmount, setOriginalFundAmount] = useState(0);
  const [date, setDate] = useState<string>(todayISO());
  const [note, setNote] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [included, setIncluded] = useState<number[]>([]);
  const [exact, setExact] = useState<Record<number, string>>({});
  const [percent, setPercent] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadedEdit, setLoadedEdit] = useState(editId == null);
  const [saving, setSaving] = useState(false);

  const { data: groups } = useDbQuery((d) => listGroups(d), []);

  // Load the expense being edited.
  useEffect(() => {
    if (editId == null) return;
    (async () => {
      const found = await getExpense(db, editId);
      if (!found) return;
      const { expense, splits, payers } = found;
      setGroupId(expense.group_id);
      setTitle(expense.title);
      setAmountText(poishaToInput(expense.amount));
      setOriginalFundAmount(expense.fund_amount);
      const paid = payers.map((p) => ({ id: p.person_id, amount: p.amount }));
      if (expense.fund_amount > 0) paid.unshift({ id: FUND_ID, amount: expense.fund_amount });
      if (paid.length > 1) {
        setPayMode('multiple');
        setPaidAmounts(Object.fromEntries(paid.map((p) => [p.id, poishaToInput(p.amount)])));
      } else {
        setPaidBy(paid[0]?.id ?? FUND_ID);
      }
      setDate(expense.date);
      setNote(expense.note ?? '');
      setSplitType(expense.split_type);
      setIncluded(splits.map((s) => s.person_id));
      setExact(Object.fromEntries(splits.map((s) => [s.person_id, poishaToInput(s.share)])));
      setPercent(
        Object.fromEntries(splits.filter((s) => s.percent != null).map((s) => [s.person_id, String(s.percent)]))
      );
      setLoadedEdit(true);
    })();
  }, [db, editId]);

  // Pick the only event automatically.
  useEffect(() => {
    if (groupId == null && editId == null && groups?.length === 1) setGroupId(groups[0].id);
  }, [groups, groupId, editId]);

  // Load people whenever the event changes; reset split defaults for new expenses.
  useEffect(() => {
    if (groupId == null || !loadedEdit) return;
    let cancelled = false;
    Promise.all([getGroupMembers(db, groupId), getFundSummary(db, groupId)]).then(([list, fund]) => {
      if (cancelled) return;
      setMembers(list);
      setFundAvailable(fund.balance + originalFundAmount);
      const ids = list.map((p) => p.id);
      if (editId == null) {
        setIncluded(ids);
        // Default to the fund when it has money, otherwise to you.
        const fallback = fund.balance > 0 ? FUND_ID : ids.includes(me.id) ? me.id : ids[0];
        setPaidBy((prev) => (prev != null && (prev === FUND_ID || ids.includes(prev)) ? prev : fallback));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, groupId, editId, loadedEdit, me.id, originalFundAmount]);

  const total = toPoisha(amountText);
  const memberIds = members.map((m) => m.id);
  const result = computeShares(total, splitType, memberIds, included, exact, percent);
  const payerResult = computePayers(total, payMode, paidBy, [FUND_ID, ...memberIds], paidAmounts);
  const fundPart = payerResult.payers.find((p) => p.personId === FUND_ID)?.amount ?? 0;
  const fundShortBy = fundAvailable != null && fundPart > fundAvailable ? fundPart - fundAvailable : 0;

  const toggleIncluded = (id: number) =>
    setIncluded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    const found: Record<string, string> = {};
    if (groupId == null) found.group = 'Choose an event.';
    if (!title.trim()) found.title = 'What was this expense for?';
    if (total == null || total <= 0) found.amount = 'Enter a valid amount.';
    if (!found.amount && payerResult.problem) found.paidBy = payerResult.problem;
    if (!found.amount && result.problem) found.split = result.problem;
    setErrors(found);
    if (Object.keys(found).length || groupId == null || total == null) return;

    setSaving(true);
    try {
      await saveExpense(
        db,
        {
          groupId,
          title: title.trim(),
          amount: total,
          payers: payerResult.payers.filter((p) => p.personId !== FUND_ID),
          fundAmount: fundPart,
          splitType,
          date,
          note: note.trim() || null,
          splits: Object.entries(result.shares).map(([id, share]) => ({
            personId: Number(id),
            share,
            percent: splitType === 'percent' ? (result.percents[Number(id)] ?? null) : null,
          })),
        },
        editId
      );
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
      setSaving(false);
    }
  };

  const remove = () => {
    if (editId == null) return;
    Alert.alert('Delete this expense?', title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(db, editId);
          router.back();
        },
      },
    ]);
  };

  if (groups && groups.length === 0 && editId == null) {
    return (
      <Screen>
        <EmptyState
          icon="people-outline"
          title="Create an event first"
          message="Expenses are split between the people in an event."
          action={<Button title="Create an event" icon="add" onPress={() => router.replace('/event/new')} />}
        />
      </Screen>
    );
  }

  const nameOf = (p: Person) => (p.id === me.id ? 'You' : p.name);

  return (
    <Screen footer={<Button title="Save expense" icon="checkmark" onPress={save} loading={saving} />}>
      <Stack.Screen options={{ title: editId != null ? 'Edit expense' : 'Add expense' }} />

      {editId == null && params.groupId == null && groups && groups.length > 1 ? (
        <View>
          <FieldLabel label="Event" />
          <ChipRow>
            {groups.map((g) => (
              <Chip key={g.id} label={g.name} selected={g.id === groupId} onPress={() => setGroupId(g.id)} />
            ))}
          </ChipRow>
          <FieldError message={errors.group} />
        </View>
      ) : null}

      <TextField
        label="Description"
        placeholder="e.g. Dinner, Bus tickets, Groceries"
        value={title}
        onChangeText={setTitle}
        error={errors.title}
        autoCapitalize="sentences"
      />
      <MoneyField label="Amount" value={amountText} onChangeText={setAmountText} error={errors.amount} />

      {members.length > 0 ? (
        <>
          <View>
            <FieldLabel label="Paid by" />
            <ChipRow>
              <Chip
                label={
                  fundAvailable != null ? `Event fund (${fundAvailable < 0 ? '−' : ''}${formatMoney(fundAvailable)})` : 'Event fund'
                }
                selected={payMode === 'single' && paidBy === FUND_ID}
                onPress={() => {
                  setPayMode('single');
                  setPaidBy(FUND_ID);
                }}
                left={<Ionicons name="wallet-outline" size={18} color={colors.primary} />}
              />
              {members.map((p) => (
                <Chip
                  key={p.id}
                  label={nameOf(p)}
                  selected={payMode === 'single' && p.id === paidBy}
                  onPress={() => {
                    setPayMode('single');
                    setPaidBy(p.id);
                  }}
                  left={<Avatar name={p.name} size="sm" />}
                />
              ))}
              <Chip
                label="Split payment"
                selected={payMode === 'multiple'}
                onPress={() => setPayMode('multiple')}
                left={<Ionicons name="people-outline" size={18} color={colors.primary} />}
              />
            </ChipRow>
            {payMode === 'multiple' ? (
              <Card className="mt-3">
                <View className="flex-row items-center gap-3 px-4 py-2.5">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900">
                    <Ionicons name="wallet-outline" size={16} color={colors.primary} />
                  </View>
                  <Text className="flex-1 text-base text-slate-900 dark:text-slate-100">From event fund</Text>
                  <AmountBox
                    value={paidAmounts[FUND_ID] ?? ''}
                    onChange={(v) => setPaidAmounts((prev) => ({ ...prev, [FUND_ID]: v }))}
                    prefix="৳"
                  />
                </View>
                {members.map((p) => (
                  <View key={p.id}>
                    <Divider />
                    <View className="flex-row items-center gap-3 px-4 py-2.5">
                      <Avatar name={p.name} size="sm" />
                      <Text className="flex-1 text-base text-slate-900 dark:text-slate-100" numberOfLines={1}>
                        {nameOf(p)} paid
                      </Text>
                      <AmountBox
                        value={paidAmounts[p.id] ?? ''}
                        onChange={(v) => setPaidAmounts((prev) => ({ ...prev, [p.id]: v }))}
                        prefix="৳"
                      />
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}
            {payMode === 'multiple' && total ? (
              <Text
                className={cn(
                  'mt-1 px-1 text-sm',
                  payerResult.problem ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                )}>
                {payerResult.problem ?? 'Paid amounts add up ✓'}
              </Text>
            ) : null}
            {payMode === 'single' && paidBy !== FUND_ID && paidBy != null ? (
              <Text className="mt-1 px-1 text-sm text-slate-500 dark:text-slate-400">
                {paidBy === me.id ? 'You pay' : `${members.find((m) => m.id === paidBy)?.name} pays`} out of
                pocket — this counts as {paidBy === me.id ? 'your' : 'their'} contribution to the event.
              </Text>
            ) : null}
            {fundShortBy > 0 ? (
              <Text className="mt-1 px-1 text-sm text-amber-600 dark:text-amber-400">
                The fund is short by {formatMoney(fundShortBy)}. It will go negative until someone adds money.
              </Text>
            ) : null}
            <FieldError message={errors.paidBy} />
          </View>

          <View>
            <FieldLabel label="Split" />
            <SegmentedControl<SplitType>
              value={splitType}
              onChange={setSplitType}
              options={[
                { value: 'equal', label: 'Equally' },
                { value: 'exact', label: 'Amounts' },
                { value: 'percent', label: 'Percent' },
              ]}
            />
          </View>

          <Card>
            {members.map((p, i) => {
              const share = result.shares[p.id] ?? 0;
              return (
                <View key={p.id}>
                  {i > 0 ? <Divider /> : null}
                  <View className="flex-row items-center gap-3 px-4 py-2.5">
                    <Avatar name={p.name} size="sm" />
                    <Text className="flex-1 text-base text-slate-900 dark:text-slate-100" numberOfLines={1}>
                      {nameOf(p)}
                    </Text>
                    {splitType === 'equal' ? (
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: included.includes(p.id) }}
                        onPress={() => toggleIncluded(p.id)}
                        hitSlop={8}
                        className="flex-row items-center gap-3">
                        <Text className="text-sm text-slate-500 dark:text-slate-400">
                          {included.includes(p.id) ? formatMoney(share) : '—'}
                        </Text>
                        <Ionicons
                          name={included.includes(p.id) ? 'checkbox' : 'square-outline'}
                          size={24}
                          color={included.includes(p.id) ? colors.primary : colors.muted}
                        />
                      </Pressable>
                    ) : (
                      <View className="flex-row items-center gap-2">
                        {splitType === 'percent' && share > 0 ? (
                          <Text className="text-xs text-slate-400">{formatMoney(share)}</Text>
                        ) : null}
                        <AmountBox
                          value={(splitType === 'exact' ? exact : percent)[p.id] ?? ''}
                          onChange={(v) =>
                            (splitType === 'exact' ? setExact : setPercent)((prev) => ({ ...prev, [p.id]: v }))
                          }
                          prefix={splitType === 'exact' ? '৳' : undefined}
                          suffix={splitType === 'percent' ? '%' : undefined}
                        />
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </Card>
          <Text
            className={cn(
              '-mt-2 px-1 text-sm',
              result.problem && total ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
            )}>
            {result.problem && total
              ? result.problem
              : splitType === 'equal'
                ? `Split equally between ${included.length} ${included.length === 1 ? 'person' : 'people'}`
                : 'Split adds up ✓'}
          </Text>
          <FieldError message={errors.split} />
        </>
      ) : null}

      <DateField label="Date" value={date} onChange={(v) => v && setDate(v)} />
      <TextField label="Note" optional placeholder="Anything to remember" value={note} onChangeText={setNote} />

      {editId != null ? (
        <View className="mt-4">
          <Button title="Delete expense" variant="danger" icon="trash-outline" onPress={remove} />
        </View>
      ) : null}
    </Screen>
  );
}

/** Small numeric input used in the per-person rows. */
function AmountBox({
  value,
  onChange,
  prefix,
  suffix,
}: {
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  const colors = useColors();
  return (
    <View className="h-10 w-28 flex-row items-center rounded-lg border border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-950">
      {prefix ? <Text className="text-slate-400">{prefix} </Text> : null}
      <TextInput
        className="h-full flex-1 text-right text-base text-slate-900 dark:text-slate-100"
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChange}
      />
      {suffix ? <Text className="text-slate-400"> {suffix}</Text> : null}
    </View>
  );
}
