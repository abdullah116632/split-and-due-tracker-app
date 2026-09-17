import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipRow } from '@/components/ui/chip';
import { Screen } from '@/components/ui/screen';
import { FieldError, FieldLabel, TextField } from '@/components/ui/text-field';
import { createGroup, deleteGroup, getGroup, getGroupMembers, updateGroup } from '@/db/groups';
import { listContacts } from '@/db/people';
import { useColors } from '@/lib/colors';
import { useRequiredMe } from '@/lib/me-context';
import { useDbQuery } from '@/lib/use-db-query';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Create an event, or edit its name/people when `?id=` is given.
 * Typed names that don't match an existing contact are saved as new contacts.
 */
export default function EventForm() {
  const db = useSQLiteContext();
  const me = useRequiredMe();
  const colors = useColors();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;

  const [name, setName] = useState('');
  const [includeMe, setIncludeMe] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [newNames, setNewNames] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: contacts = [] } = useDbQuery((d) => listContacts(d), []);

  useEffect(() => {
    if (editId == null) return;
    (async () => {
      const event = await getGroup(db, editId);
      if (event) setName(event.name);
      const members = await getGroupMembers(db, editId);
      setIncludeMe(members.some((m) => m.id === me.id));
      setSelectedIds(members.filter((m) => m.id !== me.id).map((m) => m.id));
    })();
  }, [db, editId, me.id]);

  const q = query.trim().toLowerCase();
  const suggestions = contacts.filter(
    (c) => !selectedIds.includes(c.id) && (!q || c.name.toLowerCase().includes(q))
  );
  const exactMatch = q ? contacts.find((c) => same(c.name, query)) : undefined;

  const addTyped = () => {
    const typed = query.trim();
    if (!typed) return;
    if (exactMatch) {
      if (!selectedIds.includes(exactMatch.id)) setSelectedIds((prev) => [...prev, exactMatch.id]);
    } else if (!newNames.some((n) => same(n, typed))) {
      setNewNames((prev) => [...prev, typed]);
    }
    setQuery('');
    setErrors((e) => ({ ...e, people: '' }));
  };

  const pickSuggestion = (id: number) => {
    setSelectedIds((prev) => [...prev, id]);
    setQuery('');
    setErrors((e) => ({ ...e, people: '' }));
  };

  const peopleCount = (includeMe ? 1 : 0) + selectedIds.length + newNames.length;

  const save = async () => {
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = 'Give the event a name.';
    if (query.trim()) found.people = 'Tap “Add” to add the name you typed.';
    else if (peopleCount < 2) found.people = 'An event needs at least two people.';
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    const memberIds = includeMe ? [me.id, ...selectedIds] : selectedIds;
    setSaving(true);
    try {
      if (editId != null) {
        await updateGroup(db, editId, name.trim(), memberIds, newNames);
        router.back();
      } else {
        const id = await createGroup(db, name.trim(), memberIds, newNames);
        router.replace(`/event/${id}`);
      }
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
      setSaving(false);
    }
  };

  const remove = () => {
    if (editId == null) return;
    Alert.alert(
      'Delete this event?',
      'All its expenses, contributions and payments will be deleted too. People stay in your People list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteGroup(db, editId);
            router.dismissTo('/events');
          },
        },
      ]
    );
  };

  return (
    <Screen
      footer={
        <Button
          title={editId != null ? 'Save' : 'Create event'}
          icon="checkmark"
          onPress={save}
          loading={saving}
        />
      }>
      <Stack.Screen options={{ title: editId != null ? 'Edit event' : 'New event' }} />
      <TextField
        label="Event name"
        placeholder="e.g. Cox's Bazar trip, Birthday party"
        value={name}
        onChangeText={setName}
        error={errors.name}
        autoCapitalize="sentences"
        autoFocus={editId == null}
      />

      <View>
        <FieldLabel label={`People (${peopleCount})`} />
        <Card className="mb-3 flex-row items-center gap-3 px-4 py-3">
          <Avatar name={me.name} size="sm" />
          <Text className="flex-1 text-base text-slate-900 dark:text-slate-100">I’m part of this event</Text>
          <Switch
            value={includeMe}
            onValueChange={setIncludeMe}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#ffffff"
          />
        </Card>

        {selectedIds.length + newNames.length > 0 ? (
          <View className="mb-3">
            <ChipRow>
              {selectedIds.map((id) => {
                const person = contacts.find((c) => c.id === id);
                return (
                  <RemovableChip
                    key={id}
                    label={person?.name ?? '…'}
                    onRemove={() => setSelectedIds((prev) => prev.filter((x) => x !== id))}
                  />
                );
              })}
              {newNames.map((n) => (
                <RemovableChip
                  key={`new-${n}`}
                  label={n}
                  isNew
                  onRemove={() => setNewNames((prev) => prev.filter((x) => x !== n))}
                />
              ))}
            </ChipRow>
          </View>
        ) : null}

        <View className="flex-row items-start gap-2">
          <TextField
            containerClassName="flex-1"
            placeholder="Type a name to add"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={addTyped}
            submitBehavior="submit"
            returnKeyType="done"
            autoCapitalize="words"
            autoCorrect={false}
            prefix={<Ionicons name="person-add-outline" size={18} color={colors.muted} style={{ marginRight: 8 }} />}
          />
          <Button title="Add" onPress={addTyped} disabled={!query.trim()} />
        </View>
        {q && !exactMatch ? (
          <Text className="mt-1 px-1 text-xs text-slate-500 dark:text-slate-400">
            “{query.trim()}” will be added as a new person.
          </Text>
        ) : null}
        <FieldError message={errors.people} />

        {suggestions.length > 0 ? (
          <View className="mt-4">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {q ? 'Matching people' : 'Suggestions from People'}
            </Text>
            <ChipRow>
              {suggestions.map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${c.name}`}
                  onPress={() => pickSuggestion(c.id)}
                  className="h-10 flex-row items-center gap-1.5 rounded-full border border-slate-200 bg-white pl-1 pr-3 active:opacity-70 dark:border-slate-700 dark:bg-slate-900">
                  <Avatar name={c.name} size="sm" />
                  <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.name}</Text>
                  <Ionicons name="add" size={16} color={colors.primary} />
                </Pressable>
              ))}
            </ChipRow>
          </View>
        ) : null}
      </View>

      {editId != null ? (
        <View className="mt-4">
          <Button title="Delete event" variant="danger" icon="trash-outline" onPress={remove} />
        </View>
      ) : null}
    </Screen>
  );
}

function RemovableChip({ label, isNew, onRemove }: { label: string; isNew?: boolean; onRemove: () => void }) {
  const colors = useColors();
  return (
    <View className="h-10 flex-row items-center gap-1.5 rounded-full border border-teal-600 bg-teal-50 pl-1 pr-1 dark:border-teal-400 dark:bg-teal-950">
      <Avatar name={label} size="sm" />
      <Text className="text-sm font-medium text-teal-800 dark:text-teal-200">{label}</Text>
      {isNew ? (
        <Text className="rounded bg-teal-600 px-1 text-[10px] font-bold uppercase text-white dark:bg-teal-400 dark:text-teal-950">
          new
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${label}`}
        hitSlop={6}
        onPress={onRemove}
        className="h-8 w-8 items-center justify-center rounded-full active:bg-teal-100 dark:active:bg-teal-900">
        <Ionicons name="close" size={16} color={colors.primary} />
      </Pressable>
    </View>
  );
}
