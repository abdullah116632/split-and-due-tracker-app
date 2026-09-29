import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageTitle, Screen } from '@/components/ui/screen';
import { cn } from '@/lib/cn';
import { useRequiredMe } from '@/lib/me-context';

type IconName = ComponentProps<typeof Ionicons>['name'];

const EVENT_STEPS = [
  'Create an event and add people',
  'Add contributions to the event fund',
  'Add expenses, paid from the fund or by someone',
  'Tap “Settle up” to see who pays or gets back',
];

const DEBT_STEPS = [
  'Tap “I lent” or “I borrowed”',
  'Set a due date and turn on a reminder',
  'Tap “Got money back” or “I paid back” when returned',
];

export default function Home() {
  const me = useRequiredMe();
  const firstName = me.name.split(/\s+/)[0];

  return (
    <Screen edges={['top']}>
      <PageTitle title={`Hi, ${firstName}`} subtitle="Here’s how Sholoana works" />

      <GuideCard
        tone="teal"
        icon="calendar"
        title="Split event expenses"
        steps={EVENT_STEPS}
        action="Open Events"
        href="/events"
      />
      <GuideCard
        tone="amber"
        icon="swap-vertical"
        title="Track lent & borrowed money"
        steps={DEBT_STEPS}
        action="Open Debts"
        href="/debts"
      />
    </Screen>
  );
}

const TONES = {
  teal: {
    header: 'bg-teal-600 dark:bg-teal-800',
    button: 'primary' as const,
    bullet: 'bg-teal-100 dark:bg-teal-950',
    bulletText: 'text-teal-700 dark:text-teal-300',
  },
  amber: {
    header: 'bg-amber-500 dark:bg-amber-700',
    button: 'amber' as const,
    bullet: 'bg-amber-100 dark:bg-amber-950',
    bulletText: 'text-amber-700 dark:text-amber-300',
  },
};

function GuideCard({
  tone,
  icon,
  title,
  steps,
  action,
  href,
}: {
  tone: keyof typeof TONES;
  icon: IconName;
  title: string;
  steps: string[];
  action: string;
  href: Href;
}) {
  const t = TONES[tone];
  return (
    <Card>
      <View className={cn('flex-row items-center gap-3 px-4 py-3', t.header)}>
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-white/20">
          <Ionicons name={icon} size={18} color="#ffffff" />
        </View>
        <Text className="flex-1 text-base font-bold text-white">{title}</Text>
      </View>

      <View className="gap-2.5 px-4 py-3.5">
        {steps.map((step, i) => (
          <View key={step} className="flex-row items-center gap-3">
            <View className={cn('h-6 w-6 items-center justify-center rounded-full', t.bullet)}>
              <Text className={cn('text-xs font-bold', t.bulletText)}>{i + 1}</Text>
            </View>
            <Text className="flex-1 text-sm leading-5 text-slate-700 dark:text-slate-300">{step}</Text>
          </View>
        ))}
      </View>

      <View className="items-center pb-4">
        <Button
          title={action}
          icon="arrow-forward"
          size="sm"
          variant={t.button}
          className="px-5"
          onPress={() => router.push(href)}
        />
      </View>
    </Card>
  );
}
