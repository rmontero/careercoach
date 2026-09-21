'use client';

import { useCallback, useSyncExternalStore } from 'react';

type Area = 'local' | 'session';

const listeners = new Set<() => void>();
/** Write-through cache so state still works when the browser blocks storage (private mode). */
const memory = new Map<string, string>();

const cacheKey = (area: Area, key: string) => `${area}:${key}`;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function read(area: Area, key: string): string | null {
  const cached = memory.get(cacheKey(area, key));
  if (cached !== undefined) return cached;
  try {
    return (area === 'local' ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

/**
 * A string persisted in localStorage/sessionStorage, read through useSyncExternalStore so the
 * server render and first client render agree (null) and the saved value appears right after
 * hydration without a setState-in-effect.
 */
export function useStoredString(area: Area, key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(area, key),
    () => null,
  );
  const set = useCallback(
    (next: string) => {
      memory.set(cacheKey(area, key), next);
      try {
        (area === 'local' ? window.localStorage : window.sessionStorage).setItem(key, next);
      } catch {
        // Blocked storage: the in-memory copy above keeps the UI working for this tab.
      }
      listeners.forEach((l) => l());
    },
    [area, key],
  );
  return [value, set];
}
