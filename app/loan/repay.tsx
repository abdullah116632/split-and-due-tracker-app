import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Screen } from '@/components/ui/screen';
import { MoneyField, TextField } from '@/components/ui/text-field';
import {
  deleteRepayment,
  getLoan,
  getRepayment,
  saveRepayment,
  type LoanWithStatus,
} from '@/db/loans';
import { formatDate, todayISO } from '@/lib/date';
import { formatMoney, poishaToInput, toPoisha } from '@/lib/money';
import { syncLoanReminder } from '@/lib/notifications';

/** Record money returned against a debt (`?loanId=`), or edit a return (`?id=`). */
export default function RepaymentForm() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string; loanId?: string }>();
  const editId = params.id ? Number(params.id) : undefined;

  const [loanId, setLoanId] = useState<number | null>(params.loanId ? Number(params.loanId) : null);
  const [loan, setLoan] = useState<LoanWithStatus | null>(null);
  /** Amount of this return before editing (so it can be re-assigned). */
  const [previousAmount, setPreviousAmount] = useState(0);
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editId == null) return;
    getRepayment(db, editId).then((r) => {
      if (!r) return;
      setLoanId(r.loan_id);
      setPreviousAmount(r.amount);
      setAmountText(poishaToInput(r.amount));
      setDate(r.date);
      setNote(r.note ?? '');
    });
  }, [db, editId]);

  useEffect(() => {
    if (loanId == null) return;
    getLoan(db, loanId).then((l) => {
      setLoan(l);
      if (l && editId == null) setAmountText(poishaToInput(l.remaining));
    });
  }, [db, loanId, editId]);

  const maxAmount = loan ? loan.remaining + previousAmount : 0;
  const lent = loan?.direction === 'lent';

  const save = async () => {
    const amount = toPoisha(amountText);
    if (amount == null || amount <= 0) return setError('Enter a valid amount.');
    if (amount > maxAmount) return setError(`Only ${formatMoney(maxAmount)} is still owed.`);
    if (loanId == null) return;
    setError(null);
    setSaving(true);
    try {
      await saveRepayment(db, { loanId, amount, date, note: note.trim() || null }, editId);
      // Fully paid debts shouldn't remind anymore; partly paid ones remind the new amount.
      await syncLoanReminder(db, loanId);
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
      setSaving(false);
    }
  };

  const remove = () => {
    if (editId == null || loanId == null) return;
    Alert.alert('Delete this return?', 'The debt will be open again for this amount.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRepayment(db, editId);
          await syncLoanReminder(db, loanId);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen footer={<Button title="Save return" icon="checkmark" onPress={save} loading={saving} />}>
      <Stack.Screen options={{ title: editId != null ? 'Edit return' : 'Record a return' }} />

      {loan ? (
        <Card className="p-4">
          <View className="flex-row items-center gap-3">
            <Avatar name={loan.person_name} />
            <View className="flex-1">
              <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {lent ? `${loan.person_name} is paying you back` : `You are paying back ${loan.person_name}`}
              </Text>
              <Text className="text-sm text-slate-500 dark:text-slate-400">
                {lent ? 'Lent' : 'Borrowed'} {formatMoney(loan.amount)} on {formatDate(loan.date)}
              </Text>
            </View>
          </View>
          <View className="mt-4 flex-row border-t border-slate-100 pt-3 dark:border-slate-800">
            <View className="flex-1">
              <Text className="text-xs text-slate-500 dark:text-slate-400">Returned so far</Text>
              <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {formatMoney(loan.repaid - previousAmount)}
              </Text>
            </View>
            <View className="flex-1 items-end">
              <Text className="text-xs text-slate-500 dark:text-slate-400">Still owed</Text>
              <Text
                className={
                  lent
                    ? 'text-base font-semibold text-emerald-600 dark:text-emerald-400'
                    : 'text-base font-semibold text-rose-600 dark:text-rose-400'
                }>
                {formatMoney(maxAmount)}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <View>
        <MoneyField label="Amount returned" value={amountText} onChangeText={setAmountText} error={error} />
        {loan && toPoisha(amountText) !== maxAmount ? (
          <Button
            title={`Full amount (${formatMoney(maxAmount)})`}
            variant="ghost"
            size="sm"
            className="mt-1 self-start px-1"
            onPress={() => setAmountText(poishaToInput(maxAmount))}
          />
        ) : null}
      </View>
      <DateField label="Date" value={date} onChange={(v) => v && setDate(v)} />
      <TextField label="Note" optional placeholder="e.g. bKash, cash" value={note} onChangeText={setNote} />

      {editId != null ? (
        <View className="mt-4">
          <Button title="Delete return" variant="danger" icon="trash-outline" onPress={remove} />
        </View>
      ) : null}
    </Screen>
  );
}
