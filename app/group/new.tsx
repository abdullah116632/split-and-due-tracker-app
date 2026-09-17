import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { PersonPicker } from '@/components/person-picker';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { FieldError, FieldLabel, TextField } from '@/components/ui/text-field';
import { createGroup, deleteGroup, getGroup, getGroupMembers, updateGroup } from '@/db/groups';
import { listContacts } from '@/db/people';
import { useRequiredMe } from '@/lib/me-context';
import { useDbQuery } from '@/lib/use-db-query';

/** Create a group, or edit name/members when `?id=` is given. */
export default function GroupForm() {
  const db = useSQLiteContext();
  const me = useRequiredMe();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;

  const [name, setName] = useState('');
  const [members, setMembers] = useState<number[]>([me.id]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Reloads on focus so a person added via "New person" appears immediately.
  const { data: contacts } = useDbQuery((d) => listContacts(d), []);

  useEffect(() => {
    if (editId == null) return;
    (async () => {
      const group = await getGroup(db, editId);
      if (group) setName(group.name);
      setMembers((await getGroupMembers(db, editId)).map((p) => p.id));
    })();
  }, [db, editId]);

  const toggle = (id: number) =>
    setMembers((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const save = async () => {
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = 'Give the group a name.';
    if (members.length < 2) found.members = 'A group needs at least two people.';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      if (editId != null) {
        await updateGroup(db, editId, name.trim(), members);
        router.back();
      } else {
        const id = await createGroup(db, name.trim(), members);
        router.replace(`/group/${id}`);
      }
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
      setSaving(false);
    }
  };

  const remove = () => {
    if (editId == null) return;
    Alert.alert(
      'Delete this group?',
      'All its expenses and settle-up payments will be deleted too. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteGroup(db, editId);
            router.dismissTo('/groups');
          },
        },
      ]
    );
  };

  const people = [me, ...(contacts ?? [])];

  return (
    <Screen footer={<Button title={editId != null ? 'Save' : 'Create group'} icon="checkmark" onPress={save} loading={saving} />}>
      <Stack.Screen options={{ title: editId != null ? 'Edit group' : 'New group' }} />
      <TextField
        label="Group name"
        placeholder="e.g. Cox's Bazar trip, Flat 4B"
        value={name}
        onChangeText={setName}
        error={errors.name}
        autoCapitalize="sentences"
        autoFocus={editId == null}
      />
      <View>
        <FieldLabel label="Members" />
        <Text className="-mt-1 mb-2 text-sm text-slate-500 dark:text-slate-400">
          Tap to include. Keep “You” selected if you’re part of this group.
        </Text>
        <PersonPicker people={people} selected={members} onToggle={toggle} />
        <FieldError message={errors.members} />
      </View>
      {editId != null ? (
        <View className="mt-4">
          <Button title="Delete group" variant="danger" icon="trash-outline" onPress={remove} />
        </View>
      ) : null}
    </Screen>
  );
}
