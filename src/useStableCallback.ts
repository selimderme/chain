import { useCallback, useLayoutEffect, useRef } from 'react';

/** Stable event identity without retaining state from an earlier render. */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const latest = useRef(callback);
  useLayoutEffect(() => { latest.current = callback; });
  return useCallback(((...args: Parameters<T>) => latest.current(...args)) as T, []);
}
