import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/cn';

// Light mode separates the card from the page with a tint; dark mode with elevation.
const TONES = {
  default: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
  tinted: 'border-teal-100 bg-teal-50 dark:border-slate-700 dark:bg-slate-800',
};

export function Card({
  children,
  className,
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <View className={cn('overflow-hidden rounded-2xl border', TONES[tone], className)}>
      {children}
    </View>
  );
}

/** Thin line between rows inside a Card. */
export function Divider() {
  return <View className="ml-16 h-px bg-slate-100 dark:bg-slate-800" />;
}
