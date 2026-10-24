'use client';

import { type RefObject, useEffect, useState } from 'react';

/**
 * Whether the page's `<footer>` has scrolled up under the fixed header.
 *
 * The landing header has no fill, and in Light the footer is the same ink as
 * the header's type, so the nav vanishes over it. The header fills itself only
 * while this is true. A page without a footer (/pricing) never turns it on.
 */
export function useHeaderOverFooter(
  headerRef: RefObject<HTMLElement | null>
): boolean {
  const [overFooter, setOverFooter] = useState(false);

  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer) return;

    const update = () => {
      const headerBottom = headerRef.current?.getBoundingClientRect().bottom;
      if (headerBottom === undefined) return;
      setOverFooter(footer.getBoundingClientRect().top < headerBottom);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [headerRef]);

  return overFooter;
}
