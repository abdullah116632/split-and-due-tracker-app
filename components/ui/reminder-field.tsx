import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, Switch, Text, View } from 'react-native';

import { useColors, useIsDark } from '@/lib/colors';
import { formatDate, parseISODate, toISODate } from '@/lib/date';

import { Button } from './button';
import { Card } from './card';
import { FieldError } from './text-field';

function formatTime(d: Date) {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Default reminder: 10:00 AM on the due date, or tomorrow if there's no future due date. */
export function defaultReminder(dueDate: string | null): number {
  const base = dueDate ? parseISODate(dueDate) : new Date();
  if (!dueDate || base.getTime() + 10 * 3600_000 <= Date.now()) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow.getTime();
  }
  base.setHours(10, 0, 0, 0);
  return base.getTime();
}

type ReminderFieldProps = {
  /** Epoch ms, or null when off. */
  value: number | null;
  onChange: (value: number | null) => void;
  dueDate: string | null;
  error?: string | null;
};

export function ReminderField({ value, onChange, dueDate, error }: ReminderFieldProps) {
  const colors = useColors();
  const isDark = useIsDark();
  const [iosMode, setIosMode] = useState<'date' | 'time' | null>(null);
  const [iosDraft, setIosDraft] = useState(new Date());
  const current = value != null ? new Date(value) : null;

  const pick = (mode: 'date' | 'time') => {
    if (!current) return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode,
        is24Hour: false,
        onChange: (event, picked) => {
          if (event.type !== 'set' || !picked) return;
          const next = new Date(current);
          if (mode === 'date') next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
          else next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
          onChange(next.getTime());
        },
      });
    } else {
      setIosDraft(current);
      setIosMode(mode);
    }
  };

  const past = current != null && current.getTime() <= Date.now();

  return (
    <View>
      <Card>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
            <Ionicons name="alarm-outline" size={18} color="#d97706" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-medium text-slate-900 dark:text-slate-100">Remind me</Text>
            <Text className="text-xs text-slate-500 dark:text-slate-400">Get a notification on this phone</Text>
          </View>
          <Switch
            value={value != null}
            onValueChange={(on) => onChange(on ? defaultReminder(dueDate) : null)}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#ffffff"
          />
        </View>
        {current ? (
          <View className="flex-row gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <Pressable
              onPress={() => pick('date')}
              className="h-11 flex-1 flex-row items-center gap-2 rounded-xl bg-slate-100 px-3 active:opacity-70 dark:bg-slate-800">
              <Ionicons name="calendar-outline" size={16} color={colors.muted} />
              <Text className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {formatDate(toISODate(current))}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => pick('time')}
              className="h-11 flex-row items-center gap-2 rounded-xl bg-slate-100 px-3 active:opacity-70 dark:bg-slate-800">
              <Ionicons name="time-outline" size={16} color={colors.muted} />
              <Text className="text-sm font-medium text-slate-900 dark:text-slate-100">{formatTime(current)}</Text>
            </Pressable>
          </View>
        ) : null}
      </Card>
      {error ? (
        <FieldError message={error} />
      ) : past ? (
        <Text className="mt-1 text-sm text-amber-600 dark:text-amber-400">
          This time has passed. Pick a new time to be reminded again.
        </Text>
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={iosMode != null} transparent animationType="fade" onRequestClose={() => setIosMode(null)}>
          <View className="flex-1 justify-end bg-black/40">
            <View className="rounded-t-3xl bg-white p-4 pb-10 dark:bg-slate-900">
              <DateTimePicker
                value={iosDraft}
                mode={iosMode ?? 'date'}
                display={iosMode === 'time' ? 'spinner' : 'inline'}
                themeVariant={isDark ? 'dark' : 'light'}
                accentColor={colors.primary}
                onChange={(_, d) => d && setIosDraft(d)}
              />
              <View className="mt-2 flex-row gap-3">
                <Button title="Cancel" variant="secondary" className="flex-1" onPress={() => setIosMode(null)} />
                <Button
                  title="Done"
                  className="flex-1"
                  onPress={() => {
                    onChange(iosDraft.getTime());
                    setIosMode(null);
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
