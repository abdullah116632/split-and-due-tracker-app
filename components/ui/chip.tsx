import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { useColors } from '@/lib/colors';

export function Chip({
  label,
  selected,
  onPress,
  left,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  left?: ReactNode;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn(
        'h-10 flex-row items-center gap-1.5 rounded-full border px-3 active:opacity-70',
        selected
          ? 'border-teal-600 bg-teal-50 dark:border-teal-400 dark:bg-teal-950'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
      )}>
      {left}
      <Text
        className={cn(
          'text-sm font-medium',
          selected ? 'text-teal-800 dark:text-teal-200' : 'text-slate-700 dark:text-slate-300'
        )}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap gap-2">{children}</View>;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            className={cn(
              'h-9 flex-1 items-center justify-center rounded-lg',
              active && 'bg-white dark:bg-slate-950'
            )}>
            <Text
              className={cn(
                'text-sm font-semibold',
                active ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
              )}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
