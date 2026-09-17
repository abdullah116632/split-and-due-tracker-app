import { router } from 'expo-router';
import { Text, View } from 'react-native';

import type { ActivityItem } from '@/db/activity';
import { dueLabel, formatDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/cn';

import { Card, Divider } from './ui/card';
import { ListRow, RowIcon } from './ui/list-row';

function describe(item: ActivityItem) {
  const person = item.person_is_me ? 'You' : (item.person_name ?? '');
  switch (item.kind) {
    case 'expense': {
      // Everyone who paid: people out of pocket, plus the fund if it paid a part.
      const payerCount = (item.payer_count ?? 0) + ((item.fund_amount ?? 0) > 0 ? 1 : 0);
      const first = item.person_id != null ? person : 'Event fund';
      const payers = payerCount > 1 ? `${first} +${payerCount - 1}` : first;
      return {
        title: item.title ?? 'Expense',
        subtitle: `${payers} paid · ${item.group_name}`,
        icon: 'receipt-outline' as const,
        tone: 'teal' as const,
        amountClass: 'text-slate-900 dark:text-slate-100',
        href: `/expense/new?id=${item.id}` as const,
      };
    }
    case 'loan': {
      const lent = item.direction === 'lent';
      const extra = item.due_date ? dueLabel(item.due_date) : item.title;
      return {
        title: lent ? `You lent ${item.person_name}` : `You borrowed from ${item.person_name}`,
        subtitle: extra ?? 'Personal',
        icon: lent ? ('arrow-up-outline' as const) : ('arrow-down-outline' as const),
        tone: lent ? ('green' as const) : ('red' as const),
        amountClass: lent ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
        href: `/loan/new?id=${item.id}` as const,
      };
    }
    case 'repayment': {
      const lent = item.direction === 'lent';
      return {
        title: lent ? `${item.person_name} paid you back` : `You paid back ${item.person_name}`,
        subtitle: item.title ?? 'Debt returned',
        icon: 'checkmark-done-outline' as const,
        tone: 'blue' as const,
        amountClass: 'text-sky-700 dark:text-sky-300',
        href: `/loan/repay?id=${item.id}` as const,
      };
    }
    case 'payment': {
      const to = item.other_is_me ? 'you' : item.other_name;
      return {
        title: `${person} paid ${to}`,
        subtitle: item.group_name ? `Settle up · ${item.group_name}` : (item.title ?? 'Personal settle up'),
        icon: 'cash-outline' as const,
        tone: 'blue' as const,
        amountClass: 'text-sky-700 dark:text-sky-300',
        href: `/settle?id=${item.id}` as const,
      };
    }
    case 'fund': {
      const refund = item.fund_kind === 'refund';
      return {
        title: refund
          ? `${person} ${item.person_is_me ? 'were' : 'was'} refunded`
          : `${person} added to fund`,
        subtitle: `${refund ? 'From fund' : 'Event fund'} · ${item.group_name}`,
        icon: refund ? ('return-down-back-outline' as const) : ('wallet-outline' as const),
        tone: 'teal' as const,
        amountClass: 'text-teal-700 dark:text-teal-300',
        href: `/fund?id=${item.id}` as const,
      };
    }
  }
}

export function ActivityRow({ item }: { item: ActivityItem }) {
  const d = describe(item);
  return (
    <ListRow
      left={<RowIcon name={d.icon} tone={d.tone} />}
      title={d.title}
      subtitle={d.subtitle}
      onPress={() => router.push(d.href)}
      right={
        <View className="items-end">
          <Text className={cn('text-base font-semibold', d.amountClass)}>{formatMoney(item.amount)}</Text>
          <Text className="mt-0.5 text-xs text-slate-400">{formatDate(item.date)}</Text>
        </View>
      }
    />
  );
}

export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <Card>
      {items.map((item, i) => (
        <View key={`${item.kind}-${item.id}`}>
          {i > 0 ? <Divider /> : null}
          <ActivityRow item={item} />
        </View>
      ))}
    </Card>
  );
}
