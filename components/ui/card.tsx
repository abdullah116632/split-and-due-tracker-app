import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/cn';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
        className
      )}>
      {children}
    </View>
  );
}

/** Thin line between rows inside a Card. */
export function Divider() {
  return <View className="ml-16 h-px bg-slate-100 dark:bg-slate-800" />;
}
