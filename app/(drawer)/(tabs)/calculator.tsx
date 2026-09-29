import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { PageTitle, Screen } from '@/components/ui/screen';
import {
  CalcError,
  evaluate,
  formatExpression,
  formatNumber,
  pressKey,
  tryEvaluate,
  type Key,
} from '@/lib/calculator';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/colors';

type HistoryItem = { expr: string; result: number };

type KeyStyle = 'digit' | 'operator' | 'function' | 'equals';

const KEY_CLASS: Record<KeyStyle, { box: string; text: string }> = {
  digit: {
    box: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800',
    text: 'text-slate-900 dark:text-slate-100',
  },
  operator: {
    box: 'bg-teal-100 dark:bg-teal-950',
    text: 'text-teal-700 dark:text-teal-300',
  },
  function: {
    box: 'bg-slate-200 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-200',
  },
  equals: {
    box: 'bg-teal-600 dark:bg-teal-400',
    text: 'text-white dark:text-teal-950',
  },
};

export default function Calculator() {
  const colors = useColors();
  const [expr, setExpr] = useState('');
  /** True right after "=", so typing a digit starts a new calculation. */
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const press = (key: Key) => {
    setError(null);
    const startFresh = justEvaluated && (/\d/.test(key) || key === '.');
    setExpr(pressKey(startFresh ? '' : expr, key));
    setJustEvaluated(false);
  };

  const equals = () => {
    if (!expr) return;
    try {
      const result = evaluate(expr);
      const asText = String(result);
      setHistory((prev) => [{ expr, result }, ...prev].slice(0, 20));
      // Very large/small results can't be edited further (exponent notation).
      setExpr(asText.includes('e') ? '' : asText);
      if (asText.includes('e')) setError(formatNumber(result));
      setJustEvaluated(true);
    } catch (e) {
      setError(e instanceof CalcError ? e.message : 'Invalid expression');
    }
  };

  const preview = justEvaluated ? null : tryEvaluate(expr);
  const hasOperator = /\d[+\-*/%]/.test(expr);

  const renderKey = (label: ReactNode, onPress: () => void, style: KeyStyle, a11y: string) => (
    <Pressable
      key={a11y}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      className={cn(
        'h-[68px] flex-1 items-center justify-center rounded-2xl active:opacity-60',
        KEY_CLASS[style].box
      )}>
      {typeof label === 'string' ? (
        <Text className={cn('text-2xl font-semibold', KEY_CLASS[style].text)}>{label}</Text>
      ) : (
        label
      )}
    </Pressable>
  );

  const digit = (d: Key) => renderKey(d, () => press(d), 'digit', d);
  const op = (key: Key, symbol: string, name: string) =>
    renderKey(symbol, () => press(key), 'operator', name);

  return (
    <Screen edges={['top']} scroll={false} contentClassName="px-4 pb-4">
      <View className="pt-4">
        <PageTitle title="Calculator" subtitle="Quick math without leaving the app" />
      </View>

      {/* Display */}
      <View className="mt-4 flex-1 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {history.length > 0 ? (
          <View className="flex-1">
            <View className="mb-1 flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">History</Text>
              <Pressable hitSlop={8} onPress={() => setHistory([])} accessibilityLabel="Clear history">
                <Text className="text-xs font-semibold text-teal-700 dark:text-teal-300">Clear</Text>
              </Pressable>
            </View>
            <ScrollView className="flex-1" contentContainerClassName="gap-2 pb-2">
              {history.map((h, i) => (
                <Pressable
                  key={`${i}-${h.expr}`}
                  onPress={() => {
                    setExpr(String(h.result).includes('e') ? '' : String(h.result));
                    setJustEvaluated(true);
                    setError(null);
                  }}
                  className="items-end active:opacity-60">
                  <Text className="text-sm text-slate-400" numberOfLines={1}>
                    {formatExpression(h.expr)} =
                  </Text>
                  <Text className="text-base font-medium text-slate-600 dark:text-slate-300" numberOfLines={1}>
                    {formatNumber(h.result)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : (
          <View className="flex-1" />
        )}

        <View className="items-end border-t border-slate-100 pt-3 dark:border-slate-800">
          <Text
            className="text-right text-4xl font-light text-slate-900 dark:text-slate-100"
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.5}>
            {expr ? formatExpression(expr) : '0'}
          </Text>
          <Text
            className={cn(
              'mt-1 h-7 text-xl',
              error ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
            )}
            numberOfLines={1}>
            {error ?? (preview != null && hasOperator ? `= ${formatNumber(preview)}` : '')}
          </Text>
        </View>
      </View>

      {/* Keypad */}
      <View className="mt-4 gap-2.5">
        <View className="flex-row gap-2.5">
          {renderKey('AC', () => {
            setExpr('');
            setError(null);
            setJustEvaluated(false);
          }, 'function', 'All clear')}
          {renderKey(
            <Ionicons name="backspace-outline" size={26} color={colors.text} />,
            () => press('back'),
            'function',
            'Delete'
          )}
          {op('%', '%', 'Percent')}
          {op('/', '÷', 'Divide')}
        </View>
        <View className="flex-row gap-2.5">
          {digit('7')}
          {digit('8')}
          {digit('9')}
          {op('*', '×', 'Multiply')}
        </View>
        <View className="flex-row gap-2.5">
          {digit('4')}
          {digit('5')}
          {digit('6')}
          {op('-', '−', 'Subtract')}
        </View>
        <View className="flex-row gap-2.5">
          {digit('1')}
          {digit('2')}
          {digit('3')}
          {op('+', '+', 'Add')}
        </View>
        <View className="flex-row gap-2.5">
          {renderKey('±', () => press('negate'), 'digit', 'Change sign')}
          {digit('0')}
          {renderKey('.', () => press('.'), 'digit', 'Decimal point')}
          {renderKey('=', equals, 'equals', 'Equals')}
        </View>
      </View>
    </Screen>
  );
}
