'use client';

import type { ComponentProps } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { circleFeedSelection } from '@/lib/domain/social/circle-routes';

/** Keep real locale-aware anchors for deep links, new tabs and no-JS use. */
export function CircleFeedLink(props: ComponentProps<typeof Link>) {
  const pathname = usePathname();
  return (
    <Link
      {...props}
      prefetch={false}
      onClick={(event) => {
        props.onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.currentTarget.target ||
          event.currentTarget.hasAttribute('download') ||
          !circleFeedSelection(pathname) ||
          typeof props.href !== 'string' ||
          !circleFeedSelection(props.href)
        )
          return;
        event.preventDefault();
        // The rendered href includes next-intl's locale prefix. Next's patched
        // history API updates usePathname without fetching a server route.
        if (window.location.pathname !== event.currentTarget.pathname) {
          window.history.pushState(null, '', event.currentTarget.href);
        }
      }}
    />
  );
}
