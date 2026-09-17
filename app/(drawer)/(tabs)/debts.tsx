import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button, Fab } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { PageTitle, Screen, SectionHeader } from '@/components/ui/screen';
import { listLoans, type LoanWithStatus } from '@/db/loans';
import type { LoanDirection } from '@/db/types';
import { cn } from '@/lib/cn';
import { daysUntil, dueLabel, formatDate, toISODate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { useDbQuery } from '@/lib/use-db-query';

export default function Debts() {
  const [direction, setDirection] = useState<LoanDirection>('lent');
  const { data: loans } = useDbQuery((db) => listLoans(db), []);

  const open = (dir: LoanDirection) => (loans ?? []).filter((l) => l.direction === dir && l.remaining > 0);
  const total = (dir: LoanDirection) => open(dir).reduce((sum, l) => sum + l.remaining, 0);

  const visible = (loans ?? []).filter((l) => l.direction === direction);
  const openLoans = visible.filter((l) => l.remaining > 0);
  const returned = visible.filter((l) => l.remaining === 0);
  const lent = direction === 'lent';

  return (
    <View className="flex-1">
      <Screen edges={['top']} contentClassName="pb-24">
        <PageTitle title="Debts" subtitle="Money you lent and borrowed" />

        <View className="flex-row gap-3">
          <SummaryTile
            label="To collect"
            amount={total('lent')}
            count={open('lent').length}
            tone="green"
            active={lent}
            onPress={() => setDirection('lent')}
          />
          <SummaryTile
            label="To pay back"
            amount={total('borrowed')}
            count={open('borrowed').length}
            tone="red"
            active={!lent}
            onPress={() => setDirection('borrowed')}
          />
        </View>

        <SegmentedControl<LoanDirection>
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'lent', label: 'I lent' },
            { value: 'borrowed', label: 'I borrowed' },
          ]}
        />

        {loans && visible.length === 0 ? (
          <Card>
            <EmptyState
              icon={lent ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
              title={lent ? 'No money lent' : 'No money borrowed'}
              message={
                lent
                  ? 'Record money you give someone, set when they should return it and get reminded.'
                  : 'Record money you take from someone and get reminded before you need to pay it back.'
              }
              action={
                <Button
                  title={lent ? 'I lent money' : 'I borrowed money'}
                  icon="add"
                  onPress={() => router.push(`/loan/new?direction=${direction}`)}
                />
              }
            />
          </Card>
        ) : null}

        {openLoans.map((loan) => (
          <DebtCard key={loan.id} loan={loan} />
        ))}

        {returned.length > 0 ? (
          <>
            <SectionHeader title={`Returned (${returned.length})`} />
            {returned.map((loan) => (
              <DebtCard key={loan.id} loan={loan} />
            ))}
          </>
        ) : null}
      </Screen>
      <Fab
        label={lent ? 'I lent' : 'I borrowed'}
        onPress={() => router.push(`/loan/new?direction=${direction}`)}
      />
    </View>
  );
}

function SummaryTile({
  label,
  amount,
  count,
  tone,
  active,
  onPress,
}: {
  label: string;
  amount: number;
  count: number;
  tone: 'green' | 'red';
  active: boolean;
  onPress: () => void;
}) {
  const green = tone === 'green';
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-1 rounded-2xl border-2 p-4 active:opacity-80',
        green ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-rose-50 dark:bg-rose-950',
        active
          ? green
            ? 'border-emerald-500'
            : 'border-rose-500'
          : 'border-transparent'
      )}>
      <View className="flex-row items-center gap-1.5">
        <Ionicons
          name={green ? 'arrow-down-circle' : 'arrow-up-circle'}
          size={18}
          color={green ? '#059669' : '#e11d48'}
        />
        <Text
          className={cn(
            'text-sm font-medium',
            green ? 'text-emerald-800 dark:text-emerald-200' : 'text-rose-800 dark:text-rose-200'
          )}>
          {label}
        </Text>
      </View>
      <Text
        className={cn(
          'mt-2 text-2xl font-bold',
          green ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
        )}
        numberOfLines={1}>
        {formatMoney(amount)}
      </Text>
      <Text className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {count} open {count === 1 ? 'debt' : 'debts'}
      </Text>
    </Pressable>
  );
}

function formatReminder(ms: number) {
  const d = new Date(ms);
  const h = d.getHours();
  const time = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  return `${formatDate(toISODate(d))}, ${time}`;
}

function DebtCard({ loan }: { loan: LoanWithStatus }) {
  const lent = loan.direction === 'lent';
  const done = loan.remaining === 0;
  const progress = loan.amount > 0 ? loan.repaid / loan.amount : 0;
  const days = loan.due_date ? daysUntil(loan.due_date) : null;
  const dueTone =
    days == null ? '' : days < 0 ? 'overdue' : days <= 3 ? 'soon' : 'later';
  const reminderUpcoming = loan.reminder_at != null && loan.reminder_at > Date.now();

  return (
    <Pressable onPress={() => router.push(`/loan/new?id=${loan.id}`)} className="active:opacity-80">
      <Card className={cn('p-4', done && 'opacity-60')}>
        <View className="flex-row items-center gap-3">
          <Avatar name={loan.person_name} />
          <View className="flex-1">
            <Text className="text-base font-semibold text-slate-900 dark:text-slate-100" numberOfLines={1}>
              {loan.person_name}
            </Text>
            <Text className="text-xs text-slate-500 dark:text-slate-400" numberOfLines={1}>
              {lent ? 'Lent' : 'Borrowed'} on {formatDate(loan.date)}
              {loan.note ? ` · ${loan.note}` : ''}
            </Text>
          </View>
          <View className="items-end">
            {done ? (
              <View className="flex-row items-center gap-1">
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Returned</Text>
              </View>
            ) : (
              <Text
                className={cn(
                  'text-lg font-bold',
                  lent ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                )}>
                {formatMoney(loan.remaining)}
              </Text>
            )}
            {loan.repaid > 0 && !done ? (
              <Text className="text-xs text-slate-400">of {formatMoney(loan.amount)}</Text>
            ) : done ? (
              <Text className="text-xs text-slate-400">{formatMoney(loan.amount)}</Text>
            ) : null}
          </View>
        </View>

        {loan.repaid > 0 && !done ? (
          <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <View
              className={cn('h-full rounded-full', lent ? 'bg-emerald-500' : 'bg-rose-500')}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </View>
        ) : null}

        {!done && (loan.due_date || reminderUpcoming) ? (
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            {loan.due_date ? (
              <View
                className={cn(
                  'flex-row items-center gap-1 rounded-full px-2.5 py-1',
                  dueTone === 'overdue' && 'bg-rose-100 dark:bg-rose-950',
                  dueTone === 'soon' && 'bg-amber-100 dark:bg-amber-950',
                  dueTone === 'later' && 'bg-slate-100 dark:bg-slate-800'
                )}>
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={dueTone === 'overdue' ? '#e11d48' : dueTone === 'soon' ? '#d97706' : '#64748b'}
                />
                <Text
                  className={cn(
                    'text-xs font-medium',
                    dueTone === 'overdue' && 'text-rose-700 dark:text-rose-300',
                    dueTone === 'soon' && 'text-amber-700 dark:text-amber-300',
                    dueTone === 'later' && 'text-slate-600 dark:text-slate-300'
                  )}>
                  {dueLabel(loan.due_date)}
                </Text>
              </View>
            ) : null}
            {reminderUpcoming ? (
              <View className="flex-row items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 dark:bg-sky-950">
                <Ionicons name="alarm-outline" size={12} color="#0284c7" />
                <Text className="text-xs font-medium text-sky-700 dark:text-sky-300">
                  {formatReminder(loan.reminder_at!)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {!done ? (
          <View className="mt-3 flex-row justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
            <Button
              title={lent ? 'Got money back' : 'I paid back'}
              icon="checkmark-done-outline"
              size="sm"
              variant={lent ? 'lightGreen' : 'lightRed'}
              onPress={() => router.push(`/loan/repay?loanId=${loan.id}`)}
            />
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}
