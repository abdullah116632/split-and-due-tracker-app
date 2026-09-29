import { Text, View } from 'react-native';

import type { Person } from '@/db/types';
import { cn } from '@/lib/cn';

import { Avatar } from './avatar';

/** Overlapping avatars with a "+N" bubble. `ringClass` should match the background behind it. */
export function AvatarStack({
  people,
  max = 5,
  ringClass = 'border-white dark:border-slate-900',
  moreClass = 'bg-slate-200 dark:bg-slate-700',
  moreTextClass = 'text-slate-700 dark:text-slate-200',
}: {
  people: Person[];
  max?: number;
  ringClass?: string;
  moreClass?: string;
  moreTextClass?: string;
}) {
  const extra = people.length - max;
  return (
    <View className="flex-row items-center">
      {people.slice(0, max).map((p, i) => (
        <View
          key={p.id}
          className={cn('rounded-full border-2', ringClass)}
          style={{ marginLeft: i === 0 ? 0 : -10, zIndex: max - i }}>
          <Avatar name={p.name} size="sm" />
        </View>
      ))}
      {extra > 0 ? (
        <View
          className={cn('h-9 w-9 items-center justify-center rounded-full border-2', ringClass, moreClass)}
          style={{ marginLeft: -10 }}>
          <Text className={cn('text-xs font-semibold', moreTextClass)}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}
