import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';

import { ActivityList } from '@/components/activity-row';
import { Amount, balanceCaption } from '@/components/ui/amount';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, Divider } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow, RowIcon } from '@/components/ui/list-row';
import { Screen, SectionHeader } from '@/components/ui/screen';
import { listActivity } from '@/db/activity';
import { getOverview } from '@/db/balances';
import { listGroupsForPerson } from '@/db/groups';
import { getPerson } from '@/db/people';
import { useColors } from '@/lib/colors';
import { useRequiredMe } from '@/lib/me-context';
import { useDbQuery } from '@/lib/use-db-query';

export default function PersonDetail() {
  const me = useRequiredMe();
  const colors = useColors();
  const personId = Number(useLocalSearchParams<{ id: string }>().id);

  const { data } = useDbQuery(async (db) => {
    const [person, overview, groups, history] = await Promise.all([
      getPerson(db, personId),
      getOverview(db, me.id),
      listGroupsForPerson(db, personId),
      listActivity(db, { personalWith: personId }),
    ]);
    const byGroup = overview.pairwise[personId] ?? {};
    return {
      person,
      total: overview.totals[personId] ?? 0,
      personal: overview.personal[personId] ?? 0,
      groups: groups.map((g) => ({ ...g, amount: byGroup[g.id] ?? 0 })),
      history,
    };
  }, [personId, me.id]);

  if (!data) return null;
  const { person, total, personal, groups, history } = data;
  if (!person) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Person not found" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: person.name,
          headerRight: () => (
            <Pressable
              accessibilityLabel="Edit person"
              hitSlop={10}
              onPress={() => router.push(`/person/new?id=${person.id}`)}>
              <Ionicons name="create-outline" size={22} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      <Card className="items-center p-5">
        <Avatar name={person.name} size="lg" />
        <Text className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100">{person.name}</Text>
        {person.phone || person.email ? (
          <View className="mt-1 flex-row gap-4">
            {person.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${person.phone}`)} className="flex-row items-center gap-1">
                <Ionicons name="call-outline" size={14} color={colors.primary} />
                <Text className="text-sm text-teal-700 dark:text-teal-300">{person.phone}</Text>
              </Pressable>
            ) : null}
            {person.email ? (
              <Pressable onPress={() => Linking.openURL(`mailto:${person.email}`)} className="flex-row items-center gap-1">
                <Ionicons name="mail-outline" size={14} color={colors.primary} />
                <Text className="text-sm text-teal-700 dark:text-teal-300">{person.email}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View className="mt-4 items-center">
          <Text className="text-sm text-slate-500 dark:text-slate-400">
            {total > 0 ? `${person.name} owes you` : total < 0 ? `You owe ${person.name}` : 'All settled up'}
          </Text>
          <Amount value={total} className="mt-1 text-3xl font-bold" />
        </View>
      </Card>

      <View className="flex-row gap-2">
        <Button
          title="I lent"
          icon="arrow-up"
          variant="secondary"
          className="flex-1 px-2"
          onPress={() => router.push(`/loan/new?personId=${person.id}&direction=lent`)}
        />
        <Button
          title="I borrowed"
          icon="arrow-down"
          variant="secondary"
          className="flex-1 px-2"
          onPress={() => router.push(`/loan/new?personId=${person.id}&direction=borrowed`)}
        />
      </View>
      <Button
        title="Settle personal balance"
        icon="swap-horizontal"
        disabled={personal === 0}
        onPress={() => router.push(`/settle?personId=${person.id}`)}
      />

      <SectionHeader title="Breakdown" />
      <Card>
        <ListRow
          left={<RowIcon name="person-outline" tone="slate" />}
          title="Personal"
          subtitle={balanceCaption(personal)}
          right={<Amount value={personal} className="text-base" />}
        />
        {groups.map((g) => (
          <View key={g.id}>
            <Divider />
            <ListRow
              left={<RowIcon name="people-outline" tone="teal" />}
              title={g.name}
              subtitle={balanceCaption(g.amount)}
              onPress={() => router.push(`/group/${g.id}`)}
              right={<Amount value={g.amount} className="text-base" />}
              chevron
            />
          </View>
        ))}
      </Card>
      <Text className="-mt-2 px-1 text-xs leading-4 text-slate-400">
        Group amounts follow each group’s suggested settle-up plan. Settle them from the group screen.
      </Text>

      <SectionHeader title="Personal history" />
      {history.length === 0 ? (
        <Card>
          <EmptyState
            icon="document-text-outline"
            title="No personal records"
            message={`Money you lend to or borrow from ${person.name} will appear here.`}
          />
        </Card>
      ) : (
        <ActivityList items={history} />
      )}
    </Screen>
  );
}
