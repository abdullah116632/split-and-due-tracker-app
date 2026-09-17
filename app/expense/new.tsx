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
import { getGroupMembers, listGroups } from '@/db/groups';
import type { Person, SplitType } from '@/db/types';
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

/** Add an expense (optionally for `?groupId=`), or edit one with `?id=`. */
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
      const { expense, splits } = found;
      setGroupId(expense.group_id);
      setTitle(expense.title);
      setAmountText(poishaToInput(expense.amount));
      setPaidBy(expense.paid_by);
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

  // Pick the only group automatically.
  useEffect(() => {
    if (groupId == null && editId == null && groups?.length === 1) setGroupId(groups[0].id);
  }, [groups, groupId, editId]);

  // Load members whenever the group changes; reset split defaults for new expenses.
  useEffect(() => {
    if (groupId == null || !loadedEdit) return;
    let cancelled = false;
    getGroupMembers(db, groupId).then((list) => {
      if (cancelled) return;
      setMembers(list);
      const ids = list.map((p) => p.id);
      if (editId == null) {
        setIncluded(ids);
        setPaidBy((prev) => (prev != null && ids.includes(prev) ? prev : ids.includes(me.id) ? me.id : ids[0]));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [db, groupId, editId, loadedEdit, me.id]);

  const total = toPoisha(amountText);
  const memberIds = members.map((m) => m.id);
  const result = computeShares(total, splitType, memberIds, included, exact, percent);

  const toggleIncluded = (id: number) =>
    setIncluded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    const found: Record<string, string> = {};
    if (groupId == null) found.group = 'Choose a group.';
    if (!title.trim()) found.title = 'What was this expense for?';
    if (total == null || total <= 0) found.amount = 'Enter a valid amount.';
    if (paidBy == null) found.paidBy = 'Who paid?';
    if (!found.amount && result.problem) found.split = result.problem;
    setErrors(found);
    if (Object.keys(found).length || groupId == null || paidBy == null || total == null) return;

    setSaving(true);
    try {
      await saveExpense(
        db,
        {
          groupId,
          title: title.trim(),
          amount: total,
          paidBy,
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
          title="Create a group first"
          message="Expenses are split between members of a group."
          action={<Button title="Create a group" icon="add" onPress={() => router.replace('/group/new')} />}
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
          <FieldLabel label="Group" />
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
              {members.map((p) => (
                <Chip
                  key={p.id}
                  label={nameOf(p)}
                  selected={p.id === paidBy}
                  onPress={() => setPaidBy(p.id)}
                  left={<Avatar name={p.name} size="sm" />}
                />
              ))}
            </ChipRow>
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
                        <View className="h-10 w-24 flex-row items-center rounded-lg border border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-950">
                          {splitType === 'exact' ? <Text className="text-slate-400">৳ </Text> : null}
                          <TextInput
                            className="h-full flex-1 text-right text-base text-slate-900 dark:text-slate-100"
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={colors.muted}
                            value={(splitType === 'exact' ? exact : percent)[p.id] ?? ''}
                            onChangeText={(v) =>
                              (splitType === 'exact' ? setExact : setPercent)((prev) => ({ ...prev, [p.id]: v }))
                            }
                          />
                          {splitType === 'percent' ? <Text className="text-slate-400"> %</Text> : null}
                        </View>
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
