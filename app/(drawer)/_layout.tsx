import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Drawer,
  DrawerContentScrollView,
  DrawerItemList,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import type { ComponentProps } from 'react';
import { Text, View, type ColorValue } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { useColors } from '@/lib/colors';
import { useRequiredMe } from '@/lib/me-context';

type IconName = ComponentProps<typeof Ionicons>['name'];

const drawerIcon =
  (icon: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={icon} color={color} size={size} />;

export default function DrawerLayout() {
  const colors = useColors();
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.text,
        drawerActiveBackgroundColor: colors.border,
        drawerStyle: { backgroundColor: colors.card },
        drawerLabelStyle: { fontWeight: '600' },
      }}>
      <Drawer.Screen name="(tabs)" options={{ title: 'Home', drawerIcon: drawerIcon('home-outline') }} />
      <Drawer.Screen name="people" options={{ title: 'People', drawerIcon: drawerIcon('person-outline') }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings', drawerIcon: drawerIcon('settings-outline') }} />
    </Drawer>
  );
}

function DrawerContent(props: DrawerContentComponentProps) {
  const me = useRequiredMe();
  return (
    <DrawerContentScrollView {...props}>
      <View className="mb-3 border-b border-slate-200 px-4 pb-5 pt-2 dark:border-slate-800">
        <Avatar name={me.name} size="lg" />
        <Text className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">{me.name}</Text>
        {me.phone || me.email ? (
          <Text className="text-sm text-slate-500 dark:text-slate-400">{me.phone ?? me.email}</Text>
        ) : null}
      </View>
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
}
