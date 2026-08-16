import type { ComponentPropsWithoutRef } from 'react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * Long-form prose primitives for docs MDX.
 *
 * Two deliberate departures from the in-app type rules, both scoped to the
 * docs surface: body leading is 1.75 rather than the app's 1.55 (continuous
 * reading needs more air than a dashboard row), and headings carry no eyebrow
 * — per the design guide, long-form pages drop them entirely.
 *
 * The ramp is 36 / 28 / 22 / 16 (h1 / h2 / h3 / body). It used to be
 * 36 / 22 / 17 / 16, which failed twice: h3 at 17px sat one pixel off body and
 * relied entirely on weight to register, and h2 in Lora *regular* carried less
 * visual weight than the semibold h3 beneath it — so a subsection could
 * out-shout the section containing it.
 *
 * Lora is now reserved for the page title alone; h2 and h3 are Be Vietnam Pro
 * at semibold. That keeps the serif meaningful (one per page) instead of it
 * being the generic heading face — and semibold is load-bearing here, because
 * a 28px sans heading at weight 400 would reintroduce the same inversion the
 * ramp above was fixed to remove.
 *
 * `scroll-mt-24` keeps the sticky docs header from covering a heading when an
 * anchor link jumps to it. The `#` affordance is appended by
 * rehype-autolink-headings and revealed on hover of its own heading.
 */

const ANCHOR =
  '[&>a.heading-anchor]:ml-2 [&>a.heading-anchor]:font-sans [&>a.heading-anchor]:font-normal [&>a.heading-anchor]:text-kallo-text-muted [&>a.heading-anchor]:no-underline [&>a.heading-anchor]:opacity-0 [&>a.heading-anchor]:transition-opacity hover:[&>a.heading-anchor]:opacity-100';

export function DocsH2({ children, ...props }: ComponentPropsWithoutRef<'h2'>) {
  return (
    <h2
      className={`mt-16 scroll-mt-24 font-semibold text-h3 text-kallo-text ${ANCHOR}`}
      {...props}
    >
      {children}
    </h2>
  );
}

export function DocsH3({ children, ...props }: ComponentPropsWithoutRef<'h3'>) {
  return (
    <h3
      className={`mt-10 scroll-mt-24 font-semibold text-h4 text-kallo-text ${ANCHOR}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function DocsParagraph(props: ComponentPropsWithoutRef<'p'>) {
  return (
    <p className="mt-4 text-base text-kallo-text leading-[1.75]" {...props} />
  );
}

const LINK_CLASS =
  'rounded-sm underline decoration-kallo-border underline-offset-4 transition-colors hover:decoration-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent';

/**
 * MDX writes internal links as plain `/docs/…`, with no locale prefix — that is
 * what keeps a page's source identical in both languages. Rendering those
 * through next-intl's `Link` is what puts the prefix back: a bare `<a>` would
 * send a reader on `/vi/docs/…` to `/docs/…`, which the middleware then
 * resolves by *detection*, quietly dropping them into English mid-document.
 *
 * Hash links stay plain anchors — that includes the `#` affordance
 * rehype-autolink-headings injects, which must not become a route change.
 */
export function DocsLink({
  href,
  className,
  ...props
}: ComponentPropsWithoutRef<'a'>) {
  const isExternal = href?.startsWith('http');
  const isInternal = href?.startsWith('/');

  if (isInternal && href) {
    return (
      <Link className={cn(LINK_CLASS, className)} href={href} {...props} />
    );
  }

  return (
    <a
      className={cn(LINK_CLASS, className)}
      href={href}
      rel={isExternal ? 'noreferrer' : undefined}
      target={isExternal ? '_blank' : undefined}
      {...props}
    />
  );
}

export function DocsUnorderedList(props: ComponentPropsWithoutRef<'ul'>) {
  return (
    <ul
      className="mt-4 list-disc space-y-2 pl-5 marker:text-kallo-text-muted"
      {...props}
    />
  );
}

export function DocsOrderedList(props: ComponentPropsWithoutRef<'ol'>) {
  return (
    <ol
      className="mt-4 list-decimal space-y-2 pl-5 marker:text-kallo-text-muted marker:tabular-nums"
      {...props}
    />
  );
}

export function DocsListItem(props: ComponentPropsWithoutRef<'li'>) {
  return (
    <li className="pl-1 text-base text-kallo-text leading-[1.75]" {...props} />
  );
}

export function DocsStrong(props: ComponentPropsWithoutRef<'strong'>) {
  return <strong className="font-semibold text-kallo-text" {...props} />;
}

/**
 * Lora italic at 300 in tan is the house accent treatment — here it carries
 * pull-quotes and the "useful uncertainty" asides.
 */
export function DocsBlockquote(props: ComponentPropsWithoutRef<'blockquote'>) {
  return (
    <blockquote
      className="mt-6 border-kallo-accent border-l-2 pl-5 font-serif text-base text-kallo-text italic leading-relaxed"
      {...props}
    />
  );
}

export function DocsHr(props: ComponentPropsWithoutRef<'hr'>) {
  return <hr className="my-12 border-kallo-border border-t" {...props} />;
}
