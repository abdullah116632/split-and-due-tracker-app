import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Amount } from '@/components/ui/amount';
import { Button, Fab } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow, RowIcon } from '@/components/ui/list-row';
import { PageTitle, Screen } from '@/components/ui/screen';
import { getAllGroupNets } from '@/db/balances';
import { listGroups } from '@/db/groups';
import { useRequiredMe } from '@/lib/me-context';
import { formatMoney } from '@/lib/money';
import { useDbQuery } from '@/lib/use-db-query';

export default function Events() {
  const me = useRequiredMe();
  const { data } = useDbQuery(async (db) => {
    const [groups, nets] = await Promise.all([listGroups(db), getAllGroupNets(db)]);
    return groups.map((g) => ({ ...g, myNet: nets[g.id]?.[me.id], isMember: me.id in (nets[g.id] ?? {}) }));
  }, [me.id]);

  return (
    <View className="flex-1">
      <Screen edges={['top']} contentClassName="pb-24">
        <PageTitle title="Events" subtitle="Trips, parties, flats — split costs together" />
        {data && data.length === 0 ? (
          <Card>
            <EmptyState
              icon="calendar-outline"
              title="No events yet"
              message="Create an event, add the people involved, then record expenses and contributions."
              action={<Button title="Create an event" icon="add" onPress={() => router.push('/event/new')} />}
            />
          </Card>
        ) : null}
        {data?.map((g) => (
          <Card key={g.id}>
            <ListRow
              left={<RowIcon name="calendar" tone="teal" />}
              title={g.name}
              subtitle={`${g.member_count} ${g.member_count === 1 ? 'person' : 'people'} · ${formatMoney(g.total_spent)} spent`}
              onPress={() => router.push(`/event/${g.id}`)}
              right={
                g.isMember ? (
                  <View className="items-end">
                    <Amount value={g.myNet ?? 0} className="text-base" />
                    <Text className="text-xs text-slate-400">
                      {(g.myNet ?? 0) > 0 ? 'you get' : (g.myNet ?? 0) < 0 ? 'you owe' : 'settled'}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-xs text-slate-400">not a member</Text>
                )
              }
            />
          </Card>
        ))}
      </Screen>
      <Fab label="New event" onPress={() => router.push('/event/new')} />
    </View>
  );
}
