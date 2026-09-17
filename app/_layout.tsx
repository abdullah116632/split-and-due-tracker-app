import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { DATABASE_NAME, initDatabase } from '@/db';
import { useColors, useIsDark } from '@/lib/colors';
import { MeProvider, useMe } from '@/lib/me-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const isDark = useIsDark();
  const colors = useColors();
  const base = isDark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase}>
      <MeProvider>
        <ThemeProvider value={theme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <RootNavigator />
        </ThemeProvider>
      </MeProvider>
    </SQLiteProvider>
  );
}

function RootNavigator() {
  const { me, loaded } = useMe();

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Protected guard={!!me}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="group/[id]" options={{ title: '' }} />
        <Stack.Screen name="person/[id]" options={{ title: '' }} />
        <Stack.Screen name="group/new" options={{ presentation: 'modal', title: 'New group' }} />
        <Stack.Screen name="expense/new" options={{ presentation: 'modal', title: 'Add expense' }} />
        <Stack.Screen name="loan/new" options={{ presentation: 'modal', title: 'Personal debt' }} />
        <Stack.Screen name="settle" options={{ presentation: 'modal', title: 'Settle up' }} />
        <Stack.Screen name="person/new" options={{ presentation: 'modal', title: 'New person' }} />
      </Stack.Protected>

      <Stack.Protected guard={!me}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
