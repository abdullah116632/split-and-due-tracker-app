import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { ActivityList } from '@/components/activity-row';
import { Amount } from '@/components/ui/amount';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, Divider } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Screen, SectionHeader } from '@/components/ui/screen';
import { listActivity } from '@/db/activity';
import { getGroupNets } from '@/db/balances';
import { getGroup, getGroupMembers } from '@/db/groups';
import { useColors } from '@/lib/colors';
import { useRequiredMe } from '@/lib/me-context';
import { formatMoney } from '@/lib/money';
import { simplifyDebts } from '@/lib/settle';
import { useDbQuery } from '@/lib/use-db-query';

export default function GroupDetail() {
  const me = useRequiredMe();
  const colors = useColors();
  const groupId = Number(useLocalSearchParams<{ id: string }>().id);

  const { data } = useDbQuery(async (db) => {
    const [group, members, nets, activity] = await Promise.all([
      getGroup(db, groupId),
      getGroupMembers(db, groupId),
      getGroupNets(db, groupId),
      listActivity(db, { groupId }),
    ]);
    return { group, members, nets, activity, transfers: simplifyDebts(nets) };
  }, [groupId]);

  if (!data) return null;
  const { group, members, nets, activity, transfers } = data;
  if (!group) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Group not found" />
      </Screen>
    );
  }

  const nameOf = (id: number) => {
    const p = members.find((m) => m.id === id);
    return p?.is_me ? 'You' : (p?.name ?? 'Unknown');
  };
  const isMember = members.some((m) => m.id === me.id);
  const myNet = nets[me.id] ?? 0;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: group.name,
          headerRight: () => (
            <Pressable
              accessibilityLabel="Edit group"
              hitSlop={10}
              onPress={() => router.push(`/group/new?id=${group.id}`)}>
              <Ionicons name="create-outline" size={22} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      <Card className="p-5">
        <View className="flex-row">
          <View className="flex-1">
            <Text className="text-sm text-slate-500 dark:text-slate-400">Total spent</Text>
            <Text className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatMoney(group.total_spent)}
            </Text>
          </View>
          {isMember ? (
            <View className="flex-1 items-end">
              <Text className="text-sm text-slate-500 dark:text-slate-400">
                {myNet > 0 ? 'You get back' : myNet < 0 ? 'You owe' : 'Your balance'}
              </Text>
              <Amount value={myNet} className="mt-1 text-2xl font-bold" />
            </View>
          ) : null}
        </View>
        <Text className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {members.length} members · {members.map((m) => (m.is_me ? 'You' : m.name)).join(', ')}
        </Text>
      </Card>

      <Button
        title="Add expense"
        icon="add"
        onPress={() => router.push(`/expense/new?groupId=${group.id}`)}
      />

      <SectionHeader title="Settle up" />
      {transfers.length === 0 ? (
        <Card className="flex-row items-center gap-3 p-4">
          <Ionicons name="checkmark-circle" size={24} color={colors.positive} />
          <Text className="flex-1 text-slate-700 dark:text-slate-300">Everyone is settled up.</Text>
        </Card>
      ) : (
        <Card>
          {transfers.map((t, i) => (
            <View key={`${t.from}-${t.to}`}>
              {i > 0 ? <Divider /> : null}
              <View className="flex-row items-center gap-3 px-4 py-3">
                <Avatar name={members.find((m) => m.id === t.from)?.name ?? '?'} size="sm" />
                <View className="flex-1">
                  <Text className="text-base text-slate-900 dark:text-slate-100">
                    <Text className="font-semibold">{nameOf(t.from)}</Text>
                    {t.from === me.id ? ' pay ' : ' pays '}
                    <Text className="font-semibold">{nameOf(t.to)}</Text>
                  </Text>
                  <Text className="text-sm font-semibold text-teal-700 dark:text-teal-300">
                    {formatMoney(t.amount)}
                  </Text>
                </View>
                <Button
                  title="Record"
                  size="sm"
                  variant="secondary"
                  onPress={() =>
                    router.push(
                      `/settle?groupId=${group.id}&from=${t.from}&to=${t.to}&amount=${t.amount}`
                    )
                  }
                />
              </View>
            </View>
          ))}
        </Card>
      )}

      <SectionHeader title="Balances" />
      <Card>
        {members.map((m, i) => {
          const net = nets[m.id] ?? 0;
          return (
            <View key={m.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                left={<Avatar name={m.name} />}
                title={m.is_me ? `${m.name} (you)` : m.name}
                subtitle={net > 0 ? 'gets back' : net < 0 ? 'owes' : 'settled'}
                onPress={m.is_me ? undefined : () => router.push(`/person/${m.id}`)}
                right={<Amount value={net} className="text-base" />}
              />
            </View>
          );
        })}
      </Card>

      <SectionHeader title="Expenses & payments" />
      {activity.length === 0 ? (
        <Card>
          <EmptyState
            icon="receipt-outline"
            title="No expenses yet"
            message="Add the first expense — who paid and how it's split."
          />
        </Card>
      ) : (
        <ActivityList items={activity} />
      )}
    </Screen>
  );
}
