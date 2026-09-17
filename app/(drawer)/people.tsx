import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Amount, balanceCaption } from '@/components/ui/amount';
import { Avatar } from '@/components/ui/avatar';
import { Button, Fab } from '@/components/ui/button';
import { Card, Divider } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { PageTitle, Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { getOverview } from '@/db/balances';
import { listContacts } from '@/db/people';
import { useColors } from '@/lib/colors';
import { useRequiredMe } from '@/lib/me-context';
import { useDbQuery } from '@/lib/use-db-query';

export default function People() {
  const me = useRequiredMe();
  const colors = useColors();
  const [search, setSearch] = useState('');
  const { data } = useDbQuery(async (db) => {
    const [contacts, overview] = await Promise.all([listContacts(db), getOverview(db, me.id)]);
    return contacts.map((p) => ({ person: p, amount: overview.personal[p.id] ?? 0 }));
  }, [me.id]);

  const q = search.trim().toLowerCase();
  const filtered = data?.filter(
    ({ person }) => !q || person.name.toLowerCase().includes(q) || person.phone?.includes(q)
  );

  return (
    <View className="flex-1">
      <Screen edges={['top']} contentClassName="pb-24">
        <PageTitle title="People" subtitle="Everyone from your events and personal debts" />
        {data && data.length > 0 ? (
          <TextField
            placeholder="Search by name or phone"
            value={search}
            onChangeText={setSearch}
            prefix={<Ionicons name="search" size={18} color={colors.muted} style={{ marginRight: 8 }} />}
            autoCorrect={false}
          />
        ) : null}

        {data && data.length === 0 ? (
          <Card>
            <EmptyState
              icon="person-add-outline"
              title="No contacts yet"
              message="Add the people you share expenses with or lend money to."
              action={<Button title="Add a person" icon="add" onPress={() => router.push('/person/new')} />}
            />
          </Card>
        ) : null}

        {filtered && filtered.length > 0 ? (
          <Card>
            {filtered.map(({ person, amount }, i) => (
              <View key={person.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  left={<Avatar name={person.name} />}
                  title={person.name}
                  subtitle={person.phone}
                  onPress={() => router.push(`/person/${person.id}`)}
                  right={
                    <View className="items-end">
                      <Amount value={amount} className="text-base" />
                      <Text className="text-xs text-slate-400">{balanceCaption(amount)}</Text>
                    </View>
                  }
                />
              </View>
            ))}
          </Card>
        ) : data && data.length > 0 ? (
          <Text className="py-8 text-center text-slate-500">No one matches “{search}”.</Text>
        ) : null}
      </Screen>
      <Fab label="Add person" icon="person-add" onPress={() => router.push('/person/new')} />
    </View>
  );
}
