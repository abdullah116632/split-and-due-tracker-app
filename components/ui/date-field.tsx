import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { useColors, useIsDark } from '@/lib/colors';
import { formatDate, parseISODate, toISODate } from '@/lib/date';

import { Button } from './button';
import { FieldLabel } from './text-field';

type DateFieldProps = {
  label: string;
  /** "YYYY-MM-DD", or null when empty (only if `optional`). */
  value: string | null;
  onChange: (value: string | null) => void;
  optional?: boolean;
  placeholder?: string;
};

export function DateField({ label, value, onChange, optional, placeholder = 'Pick a date' }: DateFieldProps) {
  const colors = useColors();
  const isDark = useIsDark();
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(new Date());
  const current = value ? parseISODate(value) : new Date();

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toISODate(date));
        },
      });
    } else {
      setIosDraft(current);
      setIosOpen(true);
    }
  };

  return (
    <View>
      <FieldLabel label={label} optional={optional} />
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={open}
          className="h-12 flex-1 flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 active:opacity-70 dark:border-slate-700 dark:bg-slate-900">
          <Ionicons name="calendar-outline" size={18} color={colors.muted} />
          <Text
            className={
              value ? 'text-base text-slate-900 dark:text-slate-100' : 'text-base text-slate-400'
            }>
            {value ? formatDate(value) : placeholder}
          </Text>
        </Pressable>
        {optional && value ? (
          <Pressable
            accessibilityLabel={`Clear ${label}`}
            onPress={() => onChange(null)}
            className="h-12 w-12 items-center justify-center rounded-xl bg-slate-100 active:opacity-70 dark:bg-slate-800">
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
          <View className="flex-1 justify-end bg-black/40">
            <View className="rounded-t-3xl bg-white p-4 pb-10 dark:bg-slate-900">
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="inline"
                themeVariant={isDark ? 'dark' : 'light'}
                accentColor={colors.primary}
                onChange={(_, date) => date && setIosDraft(date)}
              />
              <View className="mt-2 flex-row gap-3">
                <Button title="Cancel" variant="secondary" className="flex-1" onPress={() => setIosOpen(false)} />
                <Button
                  title="Done"
                  className="flex-1"
                  onPress={() => {
                    onChange(toISODate(iosDraft));
                    setIosOpen(false);
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
