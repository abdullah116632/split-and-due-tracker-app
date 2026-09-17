import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { ActivityList } from '@/components/activity-row';
import { EventHeader } from '@/components/event-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen, SectionHeader } from '@/components/ui/screen';
import { listActivity } from '@/db/activity';
import { getGroupNets } from '@/db/balances';
import { getFundSummary } from '@/db/fund';
import { getGroup, getGroupMembers } from '@/db/groups';
import { useColors } from '@/lib/colors';
import { formatMoney } from '@/lib/money';
import { useDbQuery } from '@/lib/use-db-query';

export default function EventDetail() {
  const colors = useColors();
  const eventId = Number(useLocalSearchParams<{ id: string }>().id);
  const [showSettle, setShowSettle] = useState(false);

  const { data } = useDbQuery(async (db) => {
    const [event, members, nets, activity, fund] = await Promise.all([
      getGroup(db, eventId),
      getGroupMembers(db, eventId),
      getGroupNets(db, eventId),
      listActivity(db, { groupId: eventId }),
      getFundSummary(db, eventId),
    ]);
    return { event, members, nets, activity, fund };
  }, [eventId]);

  if (!data) return null;
  const { event, members, nets, activity, fund } = data;
  if (!event) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState
          icon="alert-circle-outline"
          title="Event not found"
          action={<Button title="Go back" variant="secondary" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  // Each person settles with the event: those who owe put money into the fund,
  // those who are owed get money back from it.
  const owes = members.filter((m) => (nets[m.id] ?? 0) < 0).sort((x, y) => nets[x.id] - nets[y.id]);
  const getsBack = members.filter((m) => (nets[m.id] ?? 0) > 0).sort((x, y) => nets[y.id] - nets[x.id]);

  const expenseRecords = activity.filter((a) => a.kind === 'expense');
  // Fund contributions/refunds, plus any direct payments recorded in the event.
  const moneyRecords = activity.filter((a) => a.kind !== 'expense');

  return (
    <Screen>
      <EventHeader event={event} members={members} fund={fund} />

      <View className="flex-row gap-2">
        <Button
          title="Add contribution"
          icon="wallet-outline"
          variant="lightGreen"
          className="flex-1 px-2"
          onPress={() => router.push(`/fund?groupId=${event.id}&kind=contribution`)}
        />
        <Button
          title="Add expense"
          icon="receipt-outline"
          variant="lightRed"
          className="flex-1 px-2"
          onPress={() => router.push(`/expense/new?groupId=${event.id}`)}
        />
      </View>

      <Button
        title={showSettle ? 'Hide settle up' : 'Settle up'}
        icon={showSettle ? 'chevron-up' : 'swap-horizontal'}
        variant={showSettle ? 'secondary' : 'ghost'}
        className="border border-teal-600 dark:border-teal-400"
        onPress={() => setShowSettle((v) => !v)}
      />

      {showSettle ? (
        <>
          <SectionHeader title="Settle up" />
          {owes.length === 0 && getsBack.length === 0 ? (
            <Card className="flex-row items-center gap-3 p-4">
              <Ionicons name="checkmark-circle" size={24} color={colors.positive} />
              <Text className="flex-1 text-slate-700 dark:text-slate-300">Everyone is settled up.</Text>
            </Card>
          ) : (
            <Card>
              {owes.length > 0 ? (
                <SettleGroupLabel text="Will pay" tone="negative" />
              ) : null}
              {owes.map((m) => (
                <SettleRow
                  key={m.id}
                  name={m.name}
                  isMe={!!m.is_me}
                  amount={-nets[m.id]}
                  direction="pay"
                  onRecord={() =>
                    router.push(
                      `/fund?groupId=${event.id}&personId=${m.id}&amount=${-nets[m.id]}&kind=contribution`
                    )
                  }
                />
              ))}
              {getsBack.length > 0 ? (
                <SettleGroupLabel text="Will get back" tone="positive" />
              ) : null}
              {getsBack.map((m) => (
                <SettleRow
                  key={m.id}
                  name={m.name}
                  isMe={!!m.is_me}
                  amount={nets[m.id]}
                  direction="receive"
                  onRecord={() =>
                    router.push(`/fund?groupId=${event.id}&personId=${m.id}&amount=${nets[m.id]}&kind=refund`)
                  }
                />
              ))}
            </Card>
          )}
          {owes.length > 0 || getsBack.length > 0 ? (
            <Text className="-mt-2 px-1 text-xs leading-4 text-slate-400">
              Money is paid into and given back from the event fund. Tap “Paid” or “Given” once it’s done.
            </Text>
          ) : null}
        </>
      ) : null}

      <SectionHeader title="Expenses" />
      {expenseRecords.length === 0 ? (
        <Card>
          <EmptyState
            icon="receipt-outline"
            title="No expenses yet"
            message="Tap “Add expense” to record what was spent."
          />
        </Card>
      ) : (
        <ActivityList items={expenseRecords} />
      )}

      <SectionHeader title="Contributions" />
      {moneyRecords.length === 0 ? (
        <Card>
          <EmptyState
            icon="wallet-outline"
            title="No contributions yet"
            message="Tap “Add contribution” when someone puts money into the event fund."
          />
        </Card>
      ) : (
        <ActivityList items={moneyRecords} />
      )}
    </Screen>
  );
}

function SettleGroupLabel({ text, tone }: { text: string; tone: 'positive' | 'negative' }) {
  return (
    <Text
      className={
        tone === 'negative'
          ? 'px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400'
          : 'px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400'
      }>
      {text}
    </Text>
  );
}

function SettleRow({
  name,
  isMe,
  amount,
  direction,
  onRecord,
}: {
  name: string;
  isMe: boolean;
  amount: number;
  direction: 'pay' | 'receive';
  onRecord: () => void;
}) {
  const pay = direction === 'pay';
  return (
    <View className="flex-row items-center gap-3 px-4 py-2.5">
      <Avatar name={name} />
      <View className="flex-1">
        <Text className="text-base font-medium text-slate-900 dark:text-slate-100" numberOfLines={1}>
          {isMe ? 'You' : name}
        </Text>
        <Text
          className={
            pay
              ? 'text-base font-bold text-rose-600 dark:text-rose-400'
              : 'text-base font-bold text-emerald-600 dark:text-emerald-400'
          }>
          {pay ? 'Pays ' : 'Gets '}
          {formatMoney(amount)}
        </Text>
      </View>
      <Button title={pay ? 'Paid' : 'Given'} icon="checkmark" size="sm" variant="secondary" onPress={onRecord} />
    </View>
  );
}
