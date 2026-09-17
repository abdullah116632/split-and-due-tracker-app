import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { cn } from '@/lib/cn';
import { useColors } from '@/lib/colors';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const containerClass: Record<Variant, string> = {
  primary: 'bg-teal-600 dark:bg-teal-400',
  secondary: 'bg-slate-100 dark:bg-slate-800',
  danger: 'bg-rose-50 dark:bg-rose-950',
  ghost: 'bg-transparent',
};

const textClass: Record<Variant, string> = {
  primary: 'text-white dark:text-teal-950',
  secondary: 'text-slate-900 dark:text-slate-100',
  danger: 'text-rose-600 dark:text-rose-400',
  ghost: 'text-teal-700 dark:text-teal-300',
};

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  loading?: boolean;
  size?: 'md' | 'sm';
  className?: string;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  size = 'md',
  className,
}: ButtonProps) {
  const colors = useColors();
  const iconColor = {
    primary: colors.onPrimary,
    secondary: colors.text,
    danger: colors.negative,
    ghost: colors.primary,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      className={cn(
        'flex-row items-center justify-center gap-2 rounded-xl active:opacity-70',
        size === 'md' ? 'h-12 px-5' : 'h-9 px-3',
        containerClass[variant],
        (disabled || loading) && 'opacity-50',
        className
      )}>
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : icon ? (
        <Ionicons name={icon} size={size === 'md' ? 20 : 16} color={iconColor} />
      ) : null}
      <Text
        className={cn('font-semibold', size === 'md' ? 'text-base' : 'text-sm', textClass[variant])}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Round floating action button, bottom-right. */
export function Fab({
  icon = 'add',
  onPress,
  label,
}: {
  icon?: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  label: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
      className="absolute bottom-5 right-5 h-14 flex-row items-center gap-2 rounded-full bg-teal-600 px-5 active:opacity-80 dark:bg-teal-400">
      <Ionicons name={icon} size={22} color={colors.onPrimary} />
      <Text className="font-semibold text-white dark:text-teal-950">{label}</Text>
    </Pressable>
  );
}
