import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';
import { useColors } from '@/lib/colors';

type ListRowProps = {
  left?: ReactNode;
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
};

export function ListRow({ left, title, subtitle, right, onPress, chevron }: ListRowProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={cn('flex-row items-center gap-3 px-4 py-3', onPress && 'active:bg-slate-100 dark:active:bg-slate-800')}>
      {left}
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-medium text-slate-900 dark:text-slate-100">
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ICON_TONES = {
  teal: 'bg-teal-100 dark:bg-teal-950',
  green: 'bg-emerald-100 dark:bg-emerald-950',
  red: 'bg-rose-100 dark:bg-rose-950',
  blue: 'bg-sky-100 dark:bg-sky-950',
  slate: 'bg-slate-100 dark:bg-slate-800',
};

/** Round tinted icon used as the left element of a row. */
export function RowIcon({ name, tone = 'slate' }: { name: IconName; tone?: keyof typeof ICON_TONES }) {
  const colors = useColors();
  const iconColor = {
    teal: colors.primary,
    green: colors.positive,
    red: colors.negative,
    blue: '#0284c7',
    slate: colors.muted,
  }[tone];
  return (
    <View className={cn('h-11 w-11 items-center justify-center rounded-full', ICON_TONES[tone])}>
      <Ionicons name={name} size={20} color={iconColor} />
    </View>
  );
}
