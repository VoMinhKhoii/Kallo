import { notFound } from 'next/navigation';

/**
 * The locale segment's catch-all. Without it an unknown URL such as
 * `/en/anything` never entered `[locale]` and fell through to Next's own
 * default 404, so `app/[locale]/not-found.tsx` only ever showed for a
 * page that called `notFound()` itself. Every unmatched path now lands on
 * the one branded not-found surface.
 */
export default function CatchAllNotFound() {
  notFound();
}
