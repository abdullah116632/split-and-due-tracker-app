import type { ReactNode } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';
import { CURRENCY } from '@/lib/money';
import { useColors } from '@/lib/colors';

export function FieldLabel({ label, optional }: { label: string; optional?: boolean }) {
  return (
    <Text className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
      {label}
      {optional ? <Text className="font-normal text-slate-400"> (optional)</Text> : null}
    </Text>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Text className="mt-1 text-sm text-rose-600 dark:text-rose-400">{message}</Text>;
}

type TextFieldProps = TextInputProps & {
  label?: string;
  optional?: boolean;
  error?: string | null;
  prefix?: ReactNode;
  containerClassName?: string;
};

export function TextField({
  label,
  optional,
  error,
  prefix,
  containerClassName,
  className,
  ...inputProps
}: TextFieldProps) {
  const colors = useColors();
  return (
    <View className={containerClassName}>
      {label ? <FieldLabel label={label} optional={optional} /> : null}
      <View
        className={cn(
          'h-12 flex-row items-center rounded-xl border bg-white px-3 dark:bg-slate-900',
          error ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'
        )}>
        {prefix}
        <TextInput
          placeholderTextColor={colors.muted}
          className={cn('h-full flex-1 text-base text-slate-900 dark:text-slate-100', className)}
          {...inputProps}
        />
      </View>
      <FieldError message={error} />
    </View>
  );
}

export function MoneyField(props: Omit<TextFieldProps, 'prefix' | 'keyboardType'>) {
  return (
    <TextField
      keyboardType="decimal-pad"
      placeholder="0"
      prefix={<Text className="mr-1.5 text-lg text-slate-500 dark:text-slate-400">{CURRENCY}</Text>}
      {...props}
    />
  );
}
