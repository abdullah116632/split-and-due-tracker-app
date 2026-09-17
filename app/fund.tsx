import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { PersonPicker } from '@/components/person-picker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { Screen } from '@/components/ui/screen';
import { FieldError, FieldLabel, MoneyField, TextField } from '@/components/ui/text-field';
import { deleteFundEntry, getFundEntry, getFundSummary, saveFundEntry } from '@/db/fund';
import { getGroup, getGroupMembers } from '@/db/groups';
import type { FundEntryKind, Person } from '@/db/types';
import { todayISO } from '@/lib/date';
import { formatMoney, poishaToInput, toPoisha } from '@/lib/money';

/**
 * Put money into an event's fund, or take money back out of it.
 * Params: `?groupId=` (required for new), `?personId=`, `?amount=` (poisha),
 * `?kind=contribution|refund`, or `?id=` to edit.
 */
export default function FundEntryForm() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{
    id?: string;
    groupId?: string;
    personId?: string;
    amount?: string;
    kind?: string;
  }>();
  const editId = params.id ? Number(params.id) : undefined;

  const [groupId, setGroupId] = useState<number | null>(params.groupId ? Number(params.groupId) : null);
  const [eventName, setEventName] = useState('');
  const [members, setMembers] = useState<Person[]>([]);
  const [fundBalance, setFundBalance] = useState(0);
  const [kind, setKind] = useState<FundEntryKind>(params.kind === 'refund' ? 'refund' : 'contribution');
  const [personId, setPersonId] = useState<number | null>(params.personId ? Number(params.personId) : null);
  const [amountText, setAmountText] = useState(params.amount ? poishaToInput(Number(params.amount)) : '');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editId == null) return;
    getFundEntry(db, editId).then((entry) => {
      if (!entry) return;
      setGroupId(entry.group_id);
      setKind(entry.kind);
      setPersonId(entry.person_id);
      setAmountText(poishaToInput(entry.amount));
      setDate(entry.date);
      setNote(entry.note ?? '');
    });
  }, [db, editId]);

  useEffect(() => {
    if (groupId == null) return;
    (async () => {
      setEventName((await getGroup(db, groupId))?.name ?? '');
      setMembers(await getGroupMembers(db, groupId));
      setFundBalance((await getFundSummary(db, groupId)).balance);
    })();
  }, [db, groupId]);

  const isRefund = kind === 'refund';

  const save = async () => {
    const amount = toPoisha(amountText);
    const found: Record<string, string> = {};
    if (personId == null) found.person = isRefund ? 'Who gets the money back?' : 'Who is putting in money?';
    if (amount == null || amount <= 0) found.amount = 'Enter a valid amount.';
    setErrors(found);
    if (Object.keys(found).length || personId == null || amount == null || groupId == null) return;

    setSaving(true);
    try {
      await saveFundEntry(
        db,
        { groupId, personId, kind, amount, date, note: note.trim() || null },
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
    Alert.alert(isRefund ? 'Delete this refund?' : 'Delete this contribution?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteFundEntry(db, editId);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen
      footer={
        <Button
          title={isRefund ? 'Save refund' : 'Add to fund'}
          icon="checkmark"
          onPress={save}
          loading={saving}
        />
      }>
      <Stack.Screen
        options={{
          title: editId != null ? (isRefund ? 'Edit refund' : 'Edit contribution') : 'Event fund',
        }}
      />

      <Card className="flex-row items-center justify-between p-4">
        <View className="flex-1">
          <Text className="text-sm text-slate-500 dark:text-slate-400">{eventName} fund</Text>
          <Text className="text-xs text-slate-400">Money currently in the fund</Text>
        </View>
        <Text
          className={
            fundBalance < 0
              ? 'text-xl font-bold text-rose-600 dark:text-rose-400'
              : 'text-xl font-bold text-slate-900 dark:text-slate-100'
          }>
          {fundBalance < 0 ? '−' : ''}
          {formatMoney(fundBalance)}
        </Text>
      </Card>

      <SegmentedControl<FundEntryKind>
        value={kind}
        onChange={setKind}
        options={[
          { value: 'contribution', label: 'Put money in' },
          { value: 'refund', label: 'Take money back' },
        ]}
      />
      <Text className="-mt-2 px-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
        {isRefund
          ? 'Leftover money given back to someone from the fund.'
          : 'Money someone adds to the event fund. Expenses marked “Paid by: Event fund” are taken from it.'}
      </Text>

      <View>
        <FieldLabel label={isRefund ? 'Given back to' : 'Who put in money'} />
        <PersonPicker
          people={members}
          selected={personId != null ? [personId] : []}
          onToggle={setPersonId}
          allowAdd={false}
        />
        <FieldError message={errors.person} />
      </View>

      <MoneyField label="Amount" value={amountText} onChangeText={setAmountText} error={errors.amount} />
      <DateField label="Date" value={date} onChange={(v) => v && setDate(v)} />
      <TextField label="Note" optional placeholder="e.g. bKash, cash" value={note} onChangeText={setNote} />

      {editId != null ? (
        <View className="mt-4">
          <Button
            title={isRefund ? 'Delete refund' : 'Delete contribution'}
            variant="danger"
            icon="trash-outline"
            onPress={remove}
          />
        </View>
      ) : null}
    </Screen>
  );
}
