import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from 'expo-router';
import { DrawerActions } from 'expo-router/react-navigation';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';
import { useColors } from '@/lib/colors';

type ScreenProps = {
  children: ReactNode;
  /** Tab screens have no navigation header, so they need the top inset. */
  edges?: Edge[];
  scroll?: boolean;
  contentClassName?: string;
  /** Pinned to the bottom (e.g. a Save button). */
  footer?: ReactNode;
};

export function Screen({
  children,
  edges = ['bottom'],
  scroll = true,
  contentClassName,
  footer,
}: ScreenProps) {
  const colors = useColors();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName={cn('p-4 pb-10 gap-4', contentClassName)}>
            {children}
          </ScrollView>
        ) : (
          <View className={cn('flex-1', contentClassName)}>{children}</View>
        )}
        {footer ? (
          <View className="border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Opens the side drawer (People, Settings). */
export function MenuButton() {
  const navigation = useNavigation();
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={8}
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      className="-ml-1 mr-3 h-10 w-10 items-center justify-center rounded-full active:bg-slate-200 dark:active:bg-slate-800">
      <Ionicons name="menu" size={26} color={colors.text} />
    </Pressable>
  );
}

export function PageTitle({
  title,
  subtitle,
  right,
  menu = true,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  /** Show the drawer menu button (top-level screens). */
  menu?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between pt-2">
      {menu ? <MenuButton /> : null}
      <View className="flex-1">
        <Text className="text-3xl font-bold text-slate-900 dark:text-slate-100">{title}</Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View className="-mb-2 mt-2 flex-row items-center justify-between px-1">
      <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </Text>
      {right}
    </View>
  );
}
