import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { getMe } from '@/db/people';
import type { Person } from '@/db/types';

type MeContextValue = {
  /** The user's own person record; null until onboarding is done. */
  me: Person | null;
  loaded: boolean;
  refreshMe: () => Promise<void>;
};

const MeContext = createContext<MeContextValue | null>(null);

export function MeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [me, setMe] = useState<Person | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refreshMe = useCallback(async () => {
    setMe(await getMe(db));
    setLoaded(true);
  }, [db]);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  return <MeContext.Provider value={{ me, loaded, refreshMe }}>{children}</MeContext.Provider>;
}

export function useMe() {
  const value = useContext(MeContext);
  if (!value) throw new Error('useMe must be used inside MeProvider');
  return value;
}

/** For screens behind onboarding, where "me" always exists. */
export function useRequiredMe(): Person {
  const { me } = useMe();
  if (!me) throw new Error('Profile not set up');
  return me;
}
