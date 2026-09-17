import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';

// Full class names so Tailwind can find them.
const TONES = [
  { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-800 dark:text-teal-200' },
  { bg: 'bg-sky-100 dark:bg-sky-900', text: 'text-sky-800 dark:text-sky-200' },
  { bg: 'bg-violet-100 dark:bg-violet-900', text: 'text-violet-800 dark:text-violet-200' },
  { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-800 dark:text-amber-200' },
  { bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-800 dark:text-pink-200' },
  { bg: 'bg-lime-100 dark:bg-lime-900', text: 'text-lime-800 dark:text-lime-200' },
  { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-800 dark:text-indigo-200' },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

function toneFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}

const SIZES = {
  sm: { box: 'h-8 w-8', text: 'text-xs' },
  md: { box: 'h-11 w-11', text: 'text-sm' },
  lg: { box: 'h-16 w-16', text: 'text-xl' },
};

export function Avatar({ name, size = 'md' }: { name: string; size?: keyof typeof SIZES }) {
  const tone = toneFor(name);
  return (
    <View className={cn('items-center justify-center rounded-full', SIZES[size].box, tone.bg)}>
      <Text className={cn('font-semibold', SIZES[size].text, tone.text)}>{initials(name)}</Text>
    </View>
  );
}
