import { useCallback, useState } from 'react';
import { loadStored, saveStored } from '../utils/storage';

/** useState that is read from and written through to localStorage under `key`. */
export const useStoredState = <T,>(key: string, fallback: T) => {
  const [value, setValue] = useState<T>(() => loadStored(key, fallback));

  const update = useCallback(
    (next: T) => {
      setValue(next);
      saveStored(key, next);
    },
    [key]
  );

  return [value, update] as const;
};
