import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { createPerson } from '@/db/people';
import { useColors } from '@/lib/colors';
import { alertFirstError, validatePerson } from '@/lib/validation';
import { useMe } from '@/lib/me-context';

export default function Onboarding() {
  const db = useSQLiteContext();
  const colors = useColors();
  const { refreshMe } = useMe();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const { value, errors: found } = validatePerson({ name, phone, email });
    setErrors(found);
    alertFirstError(found);
    if (!value) return;
    setSaving(true);
    try {
      await createPerson(db, value, true);
      // The navigator switches to the main app once "me" exists.
      await refreshMe();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Screen
      edges={['top', 'bottom']}
      contentClassName="pt-12"
      footer={<Button title="Get started" icon="arrow-forward" onPress={submit} loading={saving} />}>
      <View className="items-center">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-teal-600 dark:bg-teal-400">
          <Ionicons name="wallet-outline" size={32} color={colors.onPrimary} />
        </View>
        <Text className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">Split & Due</Text>
      </View>

      <View className="mt-4 gap-4">
        <TextField
          label="Your name"
          placeholder="e.g. Abdullah"
          value={name}
          onChangeText={setName}
          error={errors.name}
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
        />
        <TextField
          label="Phone number"
          optional
          placeholder="01XXXXXXXXX"
          value={phone}
          onChangeText={setPhone}
          error={errors.phone}
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        <TextField
          label="Email"
          optional
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
      </View>

      <View className="mt-1 flex-row items-center gap-2">
        <Ionicons name="lock-closed-outline" size={14} color={colors.muted} />
        <Text className="flex-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Your data stays on this device. Back it up any time from Settings.
        </Text>
      </View>
    </Screen>
  );
}
