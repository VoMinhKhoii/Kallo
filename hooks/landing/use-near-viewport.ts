'use client';

import { type RefObject, useEffect, useState } from 'react';

/** True once the element comes within `rootMargin` of the viewport, and stays. */
export function useNearViewport(
  ref: RefObject<Element | null>,
  rootMargin: string
): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return near;
}
