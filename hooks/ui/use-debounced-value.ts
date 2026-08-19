'use client';

import { useEffect, useState } from 'react';

/** Trailing-edge debounce for a rapidly-changing value (typeahead queries).
 *  Promoted out of use-ingredient-search once the relog picker became a second
 *  consumer. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
