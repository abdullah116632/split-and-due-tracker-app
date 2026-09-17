import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ActivityList } from '@/components/activity-row';
import { Amount } from '@/components/ui/amount';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, Divider } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow, RowIcon } from '@/components/ui/list-row';
import { PageTitle, Screen, SectionHeader } from '@/components/ui/screen';
import { listActivity } from '@/db/activity';
import { getOverview } from '@/db/balances';
import { listGroups } from '@/db/groups';
import { listOpenLoansWithDueDate } from '@/db/loans';
import { listContacts } from '@/db/people';
import { useColors } from '@/lib/colors';
import { daysUntil, dueLabel, formatDate } from '@/lib/date';
import { useRequiredMe } from '@/lib/me-context';
import { formatMoney } from '@/lib/money';
import { useDbQuery } from '@/lib/use-db-query';

export default function Home() {
  const me = useRequiredMe();
  const { data } = useDbQuery(
    async (db) => {
      const [overview, contacts, recent, dueLoans, events] = await Promise.all([
        getOverview(db, me.id),
        listContacts(db),
        listActivity(db, { limit: 5 }),
        listOpenLoansWithDueDate(db),
        listGroups(db),
      ]);
      const upcoming = dueLoans.slice(0, 5);
      const balances = contacts
        .map((p) => ({ person: p, amount: overview.personal[p.id] ?? 0 }))
        .filter((b) => b.amount !== 0)
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
        .slice(0, 5);
      const eventBalances = events
        .map((e) => ({ event: e, amount: overview.myEventNets[e.id] ?? 0 }))
        .filter((b) => b.amount !== 0);
      return { overview, recent, upcoming, balances, eventBalances, hasContacts: contacts.length > 0 };
    },
    [me.id]
  );

  const firstName = me.name.split(/\s+/)[0];
  const net = data ? data.overview.toReceive - data.overview.toPay : 0;

  return (
    <Screen edges={['top']}>
      <PageTitle title={`Hi, ${firstName}`} subtitle="Here's where your money stands" />

      <View className="rounded-3xl bg-teal-600 p-5 dark:bg-teal-800">
        <Text className="text-sm font-medium text-teal-100">Net balance</Text>
        <Text className="mt-1 text-4xl font-bold text-white">
          {net < 0 ? '−' : ''}
          {formatMoney(net)}
        </Text>
        <Text className="mt-1 text-sm text-teal-100">
          {net > 0 ? 'Overall, people owe you' : net < 0 ? 'Overall, you owe others' : 'You are all settled up'}
        </Text>
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-white/15 p-3">
            <Text className="text-xs text-teal-50">You will get</Text>
            <Text className="mt-0.5 text-lg font-bold text-white">
              {formatMoney(data?.overview.toReceive ?? 0)}
            </Text>
          </View>
          <View className="flex-1 rounded-2xl bg-white/15 p-3">
            <Text className="text-xs text-teal-50">You owe</Text>
            <Text className="mt-0.5 text-lg font-bold text-white">
              {formatMoney(data?.overview.toPay ?? 0)}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row gap-2">
        <QuickAction icon="receipt-outline" label="Add expense" href="/expense/new" />
        <QuickAction icon="arrow-up-outline" label="I lent" href="/loan/new?direction=lent" />
        <QuickAction icon="arrow-down-outline" label="I borrowed" href="/loan/new?direction=borrowed" />
        <QuickAction icon="swap-vertical-outline" label="Debts" href="/debts" />
      </View>

      {data?.upcoming.length ? (
        <>
          <SectionHeader title="Upcoming dues" />
          <Card>
            {data.upcoming.map((loan, i) => {
              const overdue = daysUntil(loan.due_date!) < 0;
              return (
                <View key={loan.id}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    left={<Avatar name={loan.person_name} />}
                    title={
                      loan.direction === 'lent'
                        ? `${loan.person_name} should pay you`
                        : `You should pay ${loan.person_name}`
                    }
                    subtitle={`${dueLabel(loan.due_date!)} · ${formatDate(loan.due_date!)}`}
                    onPress={() => router.push(`/loan/new?id=${loan.id}`)}
                    right={
                      <Text
                        className={
                          overdue
                            ? 'font-semibold text-rose-600 dark:text-rose-400'
                            : 'font-semibold text-slate-900 dark:text-slate-100'
                        }>
                        {formatMoney(loan.remaining)}
                      </Text>
                    }
                  />
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      {data?.eventBalances.length ? (
        <>
          <SectionHeader
            title="Your events"
            right={<Button title="See all" variant="ghost" size="sm" onPress={() => router.push('/events')} />}
          />
          <Card>
            {data.eventBalances.map(({ event, amount }, i) => (
              <View key={event.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  left={<RowIcon name="calendar" tone="teal" />}
                  title={event.name}
                  subtitle={amount > 0 ? 'you get back' : 'you need to pay'}
                  onPress={() => router.push(`/event/${event.id}`)}
                  right={<Amount value={amount} className="text-base" />}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {data?.balances.length ? (
        <>
          <SectionHeader
            title="Personal debts"
            right={<Button title="See all" variant="ghost" size="sm" onPress={() => router.push('/debts')} />}
          />
          <Card>
            {data.balances.map(({ person, amount }, i) => (
              <View key={person.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  left={<Avatar name={person.name} />}
                  title={person.name}
                  subtitle={amount > 0 ? 'owes you' : 'you owe'}
                  onPress={() => router.push(`/person/${person.id}`)}
                  right={<Amount value={amount} className="text-base" />}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader
        title="Recent activity"
      />
      {data && data.recent.length === 0 ? (
        <Card>
          <EmptyState
            icon="sparkles-outline"
            title="Nothing here yet"
            message={
              data.hasContacts
                ? 'Add an event expense or record money you lent or borrowed.'
                : 'Start by creating an event for a trip or party, or record a personal debt.'
            }
            action={<Button title="Create an event" icon="calendar-outline" onPress={() => router.push('/event/new')} />}
          />
        </Card>
      ) : data ? (
        <ActivityList items={data.recent} />
      ) : null}
    </Screen>
  );
}

function QuickAction({
  icon,
  label,
  href,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  href: Href;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      className="flex-1 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white py-3 active:opacity-70 dark:border-slate-800 dark:bg-slate-900">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-950">
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text numberOfLines={1} className="text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}
      </Text>
    </Pressable>
  );
}
