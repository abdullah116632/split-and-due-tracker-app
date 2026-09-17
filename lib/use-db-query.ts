import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';

/**
 * Runs a database query and re-runs it whenever the screen comes into focus
 * (e.g. after closing a form), or when `deps` change.
 * `deps` must list every outside value `query` uses.
 */
export function useDbQuery<T>(query: (db: SQLiteDatabase) => Promise<T>, deps: unknown[]) {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    try {
      setData(await query(db));
      setError(null);
    } catch (e) {
      setError(e as Error);
    }
  }, [db, ...deps]);

  useFocusEffect(
    useCallback(() => {
      run();
    }, [run])
  );

  return { data, error, reload: run };
}
