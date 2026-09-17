import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { canDeletePerson, createPerson, deletePerson, getPerson, updatePerson } from '@/db/people';
import { useMe } from '@/lib/me-context';
import { validatePerson } from '@/lib/validation';

/** Add a contact, or edit one when `?id=` is given (including your own profile). */
export default function PersonForm() {
  const db = useSQLiteContext();
  const { me, refreshMe } = useMe();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id ? Number(params.id) : undefined;
  const isMe = editId != null && editId === me?.id;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editId == null) return;
    getPerson(db, editId).then((p) => {
      if (!p) return;
      setName(p.name);
      setPhone(p.phone ?? '');
      setEmail(p.email ?? '');
    });
  }, [db, editId]);

  const save = async () => {
    const { value, errors: found } = validatePerson({ name, phone, email });
    setErrors(found);
    if (!value) return;
    setSaving(true);
    try {
      if (editId != null) {
        await updatePerson(db, editId, value);
        if (isMe) await refreshMe();
      } else {
        await createPerson(db, value);
      }
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
      setSaving(false);
    }
  };

  const remove = async () => {
    if (editId == null) return;
    if (!(await canDeletePerson(db, editId))) {
      Alert.alert(
        "Can't delete",
        'This person is part of an event or has debts or payments recorded. Remove those first.'
      );
      return;
    }
    Alert.alert('Delete this person?', name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePerson(db, editId);
          router.dismissTo('/people');
        },
      },
    ]);
  };

  return (
    <Screen footer={<Button title="Save" icon="checkmark" onPress={save} loading={saving} />}>
      <Stack.Screen
        options={{ title: isMe ? 'Your profile' : editId != null ? 'Edit person' : 'New person' }}
      />
      <TextField
        label="Name"
        placeholder="e.g. Rafi Ahmed"
        value={name}
        onChangeText={setName}
        error={errors.name}
        autoCapitalize="words"
        autoFocus={editId == null}
      />
      <TextField
        label="Phone number"
        optional
        placeholder="01XXXXXXXXX"
        value={phone}
        onChangeText={setPhone}
        error={errors.phone}
        keyboardType="phone-pad"
      />
      <TextField
        label="Email"
        optional
        placeholder="name@example.com"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {editId != null && !isMe ? (
        <View className="mt-4">
          <Button title="Delete person" variant="danger" icon="trash-outline" onPress={remove} />
        </View>
      ) : null}
    </Screen>
  );
}
