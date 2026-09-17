import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useColors } from '@/lib/colors';

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View className="items-center px-6 py-12">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-950">
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text className="text-center text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</Text>
      {message ? (
        <Text className="mt-1 text-center text-sm leading-5 text-slate-500 dark:text-slate-400">{message}</Text>
      ) : null}
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  );
}
