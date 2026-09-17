import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { PersonPicker } from '@/components/person-picker';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipRow, Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { Screen } from '@/components/ui/screen';
import { FieldError, FieldLabel, MoneyField, TextField } from '@/components/ui/text-field';
import { getPersonalBalances } from '@/db/balances';
import { getGroup, getGroupMembers } from '@/db/groups';
import { deletePayment, getPayment, savePayment } from '@/db/payments';
import { listContacts } from '@/db/people';
import type { Person } from '@/db/types';
import { useColors } from '@/lib/colors';
import { todayISO } from '@/lib/date';
import { useRequiredMe } from '@/lib/me-context';
import { formatMoney, poishaToInput, toPoisha } from '@/lib/money';

/**
 * Record a settle-up payment.
 * - Event: `?groupId=&from=&to=&amount=` (prefilled from the suggested plan)
 * - Personal: `?personId=` (or nothing, then pick a person)
 * - Edit: `?id=`
 */
export default function SettleForm() {
  const db = useSQLiteContext();
  const me = useRequiredMe();
  const colors = useColors();
  const params = useLocalSearchParams<{
    id?: string;
    groupId?: string;
    from?: string;
    to?: string;
    amount?: string;
    personId?: string;
  }>();
  const editId = params.id ? Number(params.id) : undefined;

  const [groupId, setGroupId] = useState<number | null>(params.groupId ? Number(params.groupId) : null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [from, setFrom] = useState<number | null>(params.from ? Number(params.from) : null);
  const [to, setTo] = useState<number | null>(params.to ? Number(params.to) : null);
  const [amountText, setAmountText] = useState(params.amount ? poishaToInput(Number(params.amount)) : '');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [personalBalances, setPersonalBalances] = useState<Record<number, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Load an existing payment when editing.
  useEffect(() => {
    if (editId == null) return;
    getPayment(db, editId).then((p) => {
      if (!p) return;
      setGroupId(p.group_id);
      setFrom(p.from_person);
      setTo(p.to_person);
      setAmountText(poishaToInput(p.amount));
      setDate(p.date);
      setNote(p.note ?? '');
    });
  }, [db, editId]);

  // Event payments choose among its people; personal ones among contacts.
  useEffect(() => {
    (async () => {
      if (groupId != null) {
        setGroupName((await getGroup(db, groupId))?.name ?? null);
        setPeople(await getGroupMembers(db, groupId));
      } else {
        setPeople(await listContacts(db));
        const balances = await getPersonalBalances(db, me.id);
        setPersonalBalances(balances);
        if (params.personId && editId == null) pickContact(Number(params.personId), balances);
      }
    })();
    // Runs once per group/person; pickContact only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, groupId, me.id, params.personId, editId]);

  const isPersonal = groupId == null;
  const contactId = isPersonal ? (from === me.id ? to : from) : null;

  /** Personal mode: pick a contact and prefill direction + amount from their balance. */
  const pickContact = (id: number, balances = personalBalances) => {
    const balance = balances[id] ?? 0;
    if (balance < 0) {
      setFrom(me.id);
      setTo(id);
    } else {
      setFrom(id);
      setTo(me.id);
    }
    setAmountText(balance !== 0 ? poishaToInput(Math.abs(balance)) : '');
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const save = async () => {
    const amount = toPoisha(amountText);
    const found: Record<string, string> = {};
    if (from == null || to == null) found.people = isPersonal ? 'Choose a person.' : 'Choose who paid whom.';
    else if (from === to) found.people = 'Payer and receiver must be different.';
    if (amount == null || amount <= 0) found.amount = 'Enter a valid amount.';
    setErrors(found);
    if (Object.keys(found).length || from == null || to == null || amount == null) return;

    setSaving(true);
    try {
      await savePayment(db, { groupId, from, to, amount, date, note: note.trim() || null }, editId);
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
      setSaving(false);
    }
  };

  const remove = () => {
    if (editId == null) return;
    Alert.alert('Delete this payment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePayment(db, editId);
          router.back();
        },
      },
    ]);
  };

  const nameOf = (id: number | null) => {
    if (id == null) return '—';
    if (id === me.id) return 'You';
    return people.find((p) => p.id === id)?.name ?? '—';
  };

  const personalBalance = contactId != null ? (personalBalances[contactId] ?? 0) : 0;

  return (
    <Screen footer={<Button title="Record payment" icon="checkmark" onPress={save} loading={saving} />}>
      <Stack.Screen options={{ title: editId != null ? 'Edit payment' : 'Settle up' }} />

      {groupName ? (
        <Text className="text-sm text-slate-500 dark:text-slate-400">
          Event: <Text className="font-semibold text-slate-700 dark:text-slate-300">{groupName}</Text>
        </Text>
      ) : null}


      {isPersonal && editId == null ? (
        <View>
          <FieldLabel label="With" />
          <PersonPicker
            people={people}
            selected={contactId != null ? [contactId] : []}
            onToggle={(id) => pickContact(id)}
            allowAdd={false}
          />
          {contactId != null ? (
            <Text className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {personalBalance > 0
                ? `${nameOf(contactId)} owes you ${formatMoney(personalBalance)} (personal)`
                : personalBalance < 0
                  ? `You owe ${nameOf(contactId)} ${formatMoney(-personalBalance)} (personal)`
                  : 'No personal balance with this person.'}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!isPersonal ? (
        <>
          <View>
            <FieldLabel label="Who paid" />
            <ChipRow>
              {people.map((p) => (
                <Chip key={p.id} label={nameOf(p.id)} selected={p.id === from} onPress={() => setFrom(p.id)} />
              ))}
            </ChipRow>
          </View>
          <View>
            <FieldLabel label="Paid to" />
            <ChipRow>
              {people
                .filter((p) => p.id !== from)
                .map((p) => (
                  <Chip key={p.id} label={nameOf(p.id)} selected={p.id === to} onPress={() => setTo(p.id)} />
                ))}
            </ChipRow>
          </View>
        </>
      ) : null}

      {from != null && to != null ? (
        <Card className="flex-row items-center justify-between p-4">
          <View className="flex-1 items-center">
            <Avatar name={nameOf(from)} />
            <Text className="mt-1 font-medium text-slate-900 dark:text-slate-100">{nameOf(from)}</Text>
            <Text className="text-xs text-slate-400">pays</Text>
          </View>
          <Pressable
            accessibilityLabel="Swap payer and receiver"
            onPress={swap}
            className="h-11 w-11 items-center justify-center rounded-full bg-teal-50 active:opacity-70 dark:bg-teal-950">
            <Ionicons name="swap-horizontal" size={22} color={colors.primary} />
          </Pressable>
          <View className="flex-1 items-center">
            <Avatar name={nameOf(to)} />
            <Text className="mt-1 font-medium text-slate-900 dark:text-slate-100">{nameOf(to)}</Text>
            <Text className="text-xs text-slate-400">receives</Text>
          </View>
        </Card>
      ) : null}
      <FieldError message={errors.people} />

      <MoneyField label="Amount" value={amountText} onChangeText={setAmountText} error={errors.amount} />
      <DateField label="Date" value={date} onChange={(v) => v && setDate(v)} />
      <TextField label="Note" optional placeholder="e.g. bKash, cash" value={note} onChangeText={setNote} />

      {editId != null ? (
        <View className="mt-4">
          <Button title="Delete payment" variant="danger" icon="trash-outline" onPress={remove} />
        </View>
      ) : null}
    </Screen>
  );
}
