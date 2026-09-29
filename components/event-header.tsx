import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GroupListItem } from '@/db/groups';
import { useIsDark } from '@/lib/colors';
import { formatDate, toISODate } from '@/lib/date';

/**
 * Full-bleed header for the event screen: navigation and event info.
 * Must be the first child of a <Screen> (it cancels the screen padding).
 */
export function EventHeader({ event }: { event: GroupListItem }) {
  const insets = useSafeAreaInsets();
  const isDark = useIsDark();

  // Light status bar text over the coloured header while this screen is focused.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(isDark ? 'light' : 'dark');
    }, [isDark])
  );

  const created = formatDate(toISODate(new Date(event.created_at)));

  return (
    <View
      className="-mx-4 -mt-4 bg-teal-700 px-5 pb-6 dark:bg-teal-900"
      style={{ paddingTop: insets.top + 6 }}>
      <View className="flex-row items-center justify-between">
        <HeaderButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-teal-100">Event</Text>
        <HeaderButton
          icon="create-outline"
          label="Edit event"
          onPress={() => router.push(`/event/new?id=${event.id}`)}
        />
      </View>

      <View className="mt-5 flex-row items-center gap-3.5">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
          <Ionicons name="calendar" size={26} color="#ffffff" />
        </View>
        <View className="flex-1">
          <Text className="text-2xl font-bold leading-8 text-white" numberOfLines={2}>
            {event.name}
          </Text>
          <Text className="mt-1 text-sm text-teal-100">
            {event.member_count} {event.member_count === 1 ? 'person' : 'people'} · Since {created}
          </Text>
        </View>
      </View>
    </View>
  );
}

function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-full bg-white/15 active:bg-white/25">
      <Ionicons name={icon} size={22} color="#ffffff" />
    </Pressable>
  );
}
