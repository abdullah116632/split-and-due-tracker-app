import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { PersonPicker } from '@/components/person-picker';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { Screen } from '@/components/ui/screen';
import { FieldError, FieldLabel, MoneyField, TextField } from '@/components/ui/text-field';
import { deleteLoan, getLoan, saveLoan } from '@/db/loans';
import { listContacts } from '@/db/people';
import type { LoanDirection } from '@/db/types';
import { todayISO } from '@/lib/date';
import { poishaToInput, toPoisha } from '@/lib/money';
import { useDbQuery } from '@/lib/use-db-query';

/**
 * Record money lent to / borrowed from a contact.
 * Params: `?direction=lent|borrowed`, `?personId=`, or `?id=` to edit.
 */
export default function LoanForm() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string; personId?: string; direction?: string }>();
  const editId = params.id ? Number(params.id) : undefined;

  const [direction, setDirection] = useState<LoanDirection>(
    params.direction === 'borrowed' ? 'borrowed' : 'lent'
  );
  const [personId, setPersonId] = useState<number | null>(params.personId ? Number(params.personId) : null);
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: contacts } = useDbQuery((d) => listContacts(d), []);

  useEffect(() => {
    if (editId == null) return;
    getLoan(db, editId).then((loan) => {
      if (!loan) return;
      setDirection(loan.direction);
      setPersonId(loan.person_id);
      setAmountText(poishaToInput(loan.amount));
      setDate(loan.date);
      setDueDate(loan.due_date);
      setNote(loan.note ?? '');
    });
  }, [db, editId]);

  const save = async () => {
    const amount = toPoisha(amountText);
    const found: Record<string, string> = {};
    if (personId == null) found.person = 'Choose a person.';
    if (amount == null || amount <= 0) found.amount = 'Enter a valid amount.';
    if (dueDate && dueDate < date) found.dueDate = 'Due date can’t be before the date.';
    setErrors(found);
    if (Object.keys(found).length || personId == null || amount == null) return;

    setSaving(true);
    try {
      await saveLoan(
        db,
        { personId, direction, amount, date, dueDate, note: note.trim() || null },
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
    Alert.alert('Delete this record?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteLoan(db, editId);
          router.back();
        },
      },
    ]);
  };

  const selectedName = contacts?.find((c) => c.id === personId)?.name;

  return (
    <Screen footer={<Button title="Save" icon="checkmark" onPress={save} loading={saving} />}>
      <Stack.Screen options={{ title: editId != null ? 'Edit debt' : 'Personal debt' }} />

      <SegmentedControl<LoanDirection>
        value={direction}
        onChange={setDirection}
        options={[
          { value: 'lent', label: 'I lent money' },
          { value: 'borrowed', label: 'I borrowed money' },
        ]}
      />

      <View>
        <FieldLabel label={direction === 'lent' ? 'Lent to' : 'Borrowed from'} />
        <PersonPicker
          people={contacts ?? []}
          selected={personId != null ? [personId] : []}
          onToggle={(id) => setPersonId(id)}
        />
        <FieldError message={errors.person} />
      </View>

      <MoneyField label="Amount" value={amountText} onChangeText={setAmountText} error={errors.amount} />

      {selectedName ? (
        <Text className="-mt-2 px-1 text-sm text-slate-500 dark:text-slate-400">
          {direction === 'lent'
            ? `${selectedName} will owe you this amount.`
            : `You will owe ${selectedName} this amount.`}
        </Text>
      ) : null}

      <DateField label="Date" value={date} onChange={(v) => v && setDate(v)} />
      <View>
        <DateField
          label={direction === 'lent' ? 'Pay back by' : 'I should pay back by'}
          optional
          placeholder="No due date"
          value={dueDate}
          onChange={setDueDate}
        />
        <FieldError message={errors.dueDate} />
      </View>
      <TextField
        label="Note"
        optional
        placeholder="e.g. For bike repair"
        value={note}
        onChangeText={setNote}
      />

      {editId != null ? (
        <View className="mt-4">
          <Button title="Delete record" variant="danger" icon="trash-outline" onPress={remove} />
        </View>
      ) : null}
    </Screen>
  );
}
