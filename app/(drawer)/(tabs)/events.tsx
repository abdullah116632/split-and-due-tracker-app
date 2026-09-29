import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Fab } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageTitle, Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { getAllGroupNets } from '@/db/balances';
import { listFundBalances } from '@/db/fund';
import { listGroups, type GroupListItem } from '@/db/groups';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/colors';
import { formatDate, toISODate } from '@/lib/date';
import { useRequiredMe } from '@/lib/me-context';
import { formatMoney } from '@/lib/money';
import { useDbQuery } from '@/lib/use-db-query';

type EventItem = GroupListItem & {
  fundBalance: number;
  /** My net in the event, or null if I'm not part of it. */
  myNet: number | null;
};

export default function Events() {
  const me = useRequiredMe();
  const colors = useColors();
  const [search, setSearch] = useState('');

  const { data } = useDbQuery(async (db) => {
    const [groups, nets, funds] = await Promise.all([
      listGroups(db),
      getAllGroupNets(db),
      listFundBalances(db),
    ]);
    return groups.map<EventItem>((g) => ({
      ...g,
      fundBalance: funds[g.id] ?? 0,
      myNet: nets[g.id] && me.id in nets[g.id] ? nets[g.id][me.id] : null,
    }));
  }, [me.id]);

  const events = data ?? [];
  const q = search.trim().toLowerCase();
  const visible = q ? events.filter((e) => e.name.toLowerCase().includes(q)) : events;

  return (
    <View className="flex-1">
      <Screen edges={['top']} contentClassName="pb-24">
        <PageTitle
          title="Events"
          subtitle="Trips, parties & shared flats"
          right={events.length > 0 ? <CountBadge count={events.length} /> : undefined}
        />

        {events.length > 3 ? (
          <TextField
            placeholder="Search events"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            prefix={<Ionicons name="search" size={18} color={colors.muted} style={{ marginRight: 8 }} />}
          />
        ) : null}

        {data && events.length === 0 ? (
          <Card>
            <EmptyState
              icon="calendar-outline"
              title="No events yet"
              message="Create an event for a trip, party or shared flat, add the people, then record contributions and expenses."
              action={<Button title="Create an event" icon="add" onPress={() => router.push('/event/new')} />}
            />
          </Card>
        ) : null}

        {visible.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}

        {q && visible.length === 0 ? (
          <Text className="py-8 text-center text-slate-500">No event matches “{search}”.</Text>
        ) : null}
      </Screen>
      <Fab label="New event" onPress={() => router.push('/event/new')} />
    </View>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <View className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
      <Text className="text-xs font-semibold text-slate-600 dark:text-slate-300">{count}</Text>
    </View>
  );
}

function EventCard({ event }: { event: EventItem }) {
  const colors = useColors();
  const since = formatDate(toISODate(new Date(event.created_at)));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${event.name}`}
      onPress={() => router.push(`/event/${event.id}`)}
      className="active:opacity-80">
      <Card tone="tinted" className="p-4">
        <View className="flex-row items-start gap-3">
          <View className="flex-1">
            <Text className="text-base font-semibold text-slate-900 dark:text-slate-100" numberOfLines={1}>
              {event.name}
            </Text>
            <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400" numberOfLines={1}>
              {event.member_count} {event.member_count === 1 ? 'person' : 'people'} · {since}
            </Text>
          </View>
          <Status net={event.myNet} />
        </View>

        <View className="mt-3.5 flex-row items-center border-t border-teal-100 pt-3 dark:border-slate-700">
          <Stat label="Spent" value={formatMoney(event.total_spent)} />
          <Stat
            label="In fund"
            value={`${event.fundBalance < 0 ? '−' : ''}${formatMoney(event.fundBalance)}`}
            danger={event.fundBalance < 0}
          />
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>
      </Card>
    </Pressable>
  );
}

/** My position in the event, as a quiet label with the amount under it. */
function Status({ net }: { net: number | null }) {
  const [label, amount, tone] =
    net == null
      ? ['Not a member', null, 'text-slate-400 dark:text-slate-500']
      : net > 0
        ? ['You get', formatMoney(net), 'text-emerald-600 dark:text-emerald-400']
        : net < 0
          ? ['You pay', formatMoney(-net), 'text-rose-600 dark:text-rose-400']
          : ['Settled', null, 'text-slate-500 dark:text-slate-400'];

  return (
    <View className="items-end">
      <Text className={cn('text-xs', amount ? 'text-slate-500 dark:text-slate-400' : tone)} numberOfLines={1}>
        {label}
      </Text>
      {amount ? (
        <Text className={cn('mt-0.5 text-base font-bold', tone)} numberOfLines={1}>
          {amount}
        </Text>
      ) : null}
    </View>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View className="flex-1">
      <Text className="text-[11px] text-slate-500 dark:text-slate-400">{label}</Text>
      <Text
        className={cn(
          'text-sm font-semibold',
          danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
        )}
        numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
