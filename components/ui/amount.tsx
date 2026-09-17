import { Text } from 'react-native';

import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/money';

/** Money coloured by direction: green = you receive, red = you pay. */
export function Amount({
  value,
  className,
  neutral,
}: {
  value: number;
  className?: string;
  /** Ignore the sign for colouring. */
  neutral?: boolean;
}) {
  const tone = neutral
    ? 'text-slate-900 dark:text-slate-100'
    : value > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : value < 0
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-slate-500 dark:text-slate-400';
  return <Text className={cn('font-semibold', tone, className)}>{formatMoney(value)}</Text>;
}

/** "owes you" / "you owe" / "settled up" wording for a balance with one contact. */
export function balanceCaption(value: number) {
  if (value > 0) return 'owes you';
  if (value < 0) return 'you owe';
  return 'settled up';
}
