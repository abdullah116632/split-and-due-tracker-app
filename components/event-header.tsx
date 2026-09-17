import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FundSummary } from '@/db/fund';
import type { GroupListItem } from '@/db/groups';
import type { Person } from '@/db/types';
import { useIsDark } from '@/lib/colors';
import { formatDate, toISODate } from '@/lib/date';
import { formatMoney } from '@/lib/money';

import { Avatar } from './ui/avatar';

const MAX_AVATARS = 5;

/**
 * Full-bleed header for the event screen: navigation, event info, people and fund summary.
 * Must be the first child of a <Screen> (it cancels the screen padding).
 */
export function EventHeader({
  event,
  members,
  fund,
}: {
  event: GroupListItem;
  members: Person[];
  fund: FundSummary;
}) {
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
  const extra = members.length - MAX_AVATARS;
  const overspent = fund.balance < 0;

  return (
    <View
      className="-mx-4 -mt-4 rounded-b-[32px] bg-teal-700 px-5 pb-6 dark:bg-teal-900"
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
          <Text className="mt-0.5 text-sm text-teal-100">Since {created}</Text>
        </View>
      </View>

      <View className="mt-4 flex-row items-center">
        {members.slice(0, MAX_AVATARS).map((m, i) => (
          <View
            key={m.id}
            className="rounded-full border-2 border-teal-700 dark:border-teal-900"
            style={{ marginLeft: i === 0 ? 0 : -10, zIndex: MAX_AVATARS - i }}>
            <Avatar name={m.name} size="sm" />
          </View>
        ))}
        {extra > 0 ? (
          <View
            className="h-9 w-9 items-center justify-center rounded-full border-2 border-teal-700 bg-teal-800 dark:border-teal-900 dark:bg-teal-950"
            style={{ marginLeft: -10 }}>
            <Text className="text-xs font-semibold text-white">+{extra}</Text>
          </View>
        ) : null}
        <Text className="ml-3 text-sm font-medium text-teal-50">
          {members.length} {members.length === 1 ? 'person' : 'people'}
        </Text>
      </View>

      <View className="mt-5 rounded-3xl border border-white/15 bg-white/10 p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="wallet-outline" size={16} color="#ccfbf1" />
            <Text className="text-sm text-teal-100">Money in fund</Text>
          </View>
          {overspent ? (
            <View className="rounded-full bg-rose-500/90 px-2 py-0.5">
              <Text className="text-[11px] font-semibold text-white">Overspent</Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-1 text-4xl font-bold text-white">
          {overspent ? '−' : ''}
          {formatMoney(fund.balance)}
        </Text>
        {overspent ? (
          <Text className="mt-1 text-xs leading-4 text-teal-50">
            The fund spent more than it collected — someone needs to add money.
          </Text>
        ) : null}

        <View className="mt-4 flex-row border-t border-white/15 pt-3">
          <Stat label="Collected" value={fund.collected - fund.refunded} />
          <View className="mx-2 w-px bg-white/15" />
          <Stat label="From fund" value={fund.spentFromFund} />
          <View className="mx-2 w-px bg-white/15" />
          <Stat label="Total spent" value={event.total_spent} />
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1">
      <Text className="text-[11px] uppercase tracking-wide text-teal-100" numberOfLines={1}>
        {label}
      </Text>
      <Text className="mt-0.5 text-base font-bold text-white" numberOfLines={1}>
        {formatMoney(value)}
      </Text>
    </View>
  );
}
