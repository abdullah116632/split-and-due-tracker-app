import { Text } from 'react-native';

import { cn } from '@/lib/cn';

/**
 * The app name split the way the word itself is: "Sholo" (ষোলো, sixteen) and
 * "ana" (আনা), in the two brand colours from the icon. Nested <Text> inherits the
 * size and weight from `className`, so callers set those once on the outside.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Text className={cn('font-bold', className)}>
      <Text className="text-emerald-800 dark:text-emerald-300">Sholo</Text>
      <Text className="text-yellow-700 dark:text-yellow-400">ana</Text>
    </Text>
  );
}
