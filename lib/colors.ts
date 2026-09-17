import { useColorScheme } from 'nativewind';

// JS-side colors for places className can't reach (icons, navigation bars, placeholders).
// Keep in sync with the Tailwind classes used in components.
const palette = {
  light: {
    background: '#f8fafc', // slate-50
    card: '#ffffff',
    text: '#0f172a', // slate-900
    muted: '#64748b', // slate-500
    border: '#e2e8f0', // slate-200
    primary: '#0d9488', // teal-600
    positive: '#059669', // emerald-600
    negative: '#e11d48', // rose-600
    onPrimary: '#ffffff',
  },
  dark: {
    background: '#020617', // slate-950
    card: '#0f172a', // slate-900
    text: '#f1f5f9', // slate-100
    muted: '#94a3b8', // slate-400
    border: '#1e293b', // slate-800
    primary: '#2dd4bf', // teal-400
    positive: '#34d399', // emerald-400
    negative: '#fb7185', // rose-400
    onPrimary: '#042f2e',
  },
};

export type Colors = typeof palette.light;

export function useColors(): Colors {
  const { colorScheme } = useColorScheme();
  return palette[colorScheme === 'dark' ? 'dark' : 'light'];
}

export function useIsDark(): boolean {
  return useColorScheme().colorScheme === 'dark';
}
