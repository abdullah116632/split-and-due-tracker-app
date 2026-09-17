import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import type { Person } from '@/db/types';
import { useColors } from '@/lib/colors';

import { Avatar } from './ui/avatar';
import { Chip, ChipRow } from './ui/chip';

type PersonPickerProps = {
  people: Person[];
  /** Selected ids. Single-select pickers pass one id. */
  selected: number[];
  onToggle: (id: number) => void;
  /** Show a "New person" chip that opens the add-contact form. */
  allowAdd?: boolean;
  /** Label to show for the user's own record. */
  meLabel?: string;
};

export function PersonPicker({ people, selected, onToggle, allowAdd = true, meLabel = 'You' }: PersonPickerProps) {
  const colors = useColors();
  return (
    <ChipRow>
      {people.map((p) => (
        <Chip
          key={p.id}
          label={p.is_me ? meLabel : p.name}
          selected={selected.includes(p.id)}
          onPress={() => onToggle(p.id)}
          left={<Avatar name={p.name} size="sm" />}
        />
      ))}
      {allowAdd ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/person/new')}
          className="h-10 flex-row items-center gap-1 rounded-full border border-dashed border-teal-600 px-3 active:opacity-70 dark:border-teal-400">
          <Ionicons name="person-add-outline" size={16} color={colors.primary} />
          <Text className="text-sm font-medium text-teal-700 dark:text-teal-300">New person</Text>
        </Pressable>
      ) : null}
    </ChipRow>
  );
}
