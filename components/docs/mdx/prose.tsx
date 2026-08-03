import type { ComponentPropsWithoutRef } from 'react';

/**
 * Long-form prose primitives for docs MDX.
 *
 * Two deliberate departures from the in-app type rules, both scoped to the
 * docs surface: body leading is 1.75 rather than the app's 1.55 (continuous
 * reading needs more air than a dashboard row), and headings carry no eyebrow
 * — per the design guide, long-form pages drop them entirely.
 *
 * The ramp is 36 / 28 / 19 / 16 (h1 / h2 / h3 / body). It used to be
 * 36 / 22 / 17 / 16, which failed twice: h3 at 17px sat one pixel off body and
 * relied entirely on weight to register, and h2 at 22px in Lora *regular*
 * carried less visual weight than the 17px semibold h3 beneath it — so a
 * subsection could out-shout the section containing it.
 *
 * `scroll-mt-24` keeps the sticky docs header from covering a heading when an
 * anchor link jumps to it. The `#` affordance is appended by
 * rehype-autolink-headings and revealed on hover of its own heading.
 */

const ANCHOR =
  '[&>a.heading-anchor]:ml-2 [&>a.heading-anchor]:font-sans [&>a.heading-anchor]:font-normal [&>a.heading-anchor]:text-nham-text-muted [&>a.heading-anchor]:no-underline [&>a.heading-anchor]:opacity-0 [&>a.heading-anchor]:transition-opacity hover:[&>a.heading-anchor]:opacity-100';

export function DocsH2({ children, ...props }: ComponentPropsWithoutRef<'h2'>) {
  return (
    <h2
      className={`mt-16 scroll-mt-24 font-serif text-h3 text-nham-text ${ANCHOR}`}
      {...props}
    >
      {children}
    </h2>
  );
}

export function DocsH3({ children, ...props }: ComponentPropsWithoutRef<'h3'>) {
  return (
    <h3
      className={`mt-10 scroll-mt-24 font-semibold text-h4 text-nham-text ${ANCHOR}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function DocsParagraph(props: ComponentPropsWithoutRef<'p'>) {
  return (
    <p className="mt-4 text-base text-nham-text leading-[1.75]" {...props} />
  );
}

export function DocsLink({ href, ...props }: ComponentPropsWithoutRef<'a'>) {
  const isExternal = href?.startsWith('http');

  return (
    <a
      className="rounded-sm underline decoration-nham-border underline-offset-4 transition-colors hover:decoration-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
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
      className="mt-4 list-disc space-y-2 pl-5 marker:text-nham-text-muted"
      {...props}
    />
  );
}

export function DocsOrderedList(props: ComponentPropsWithoutRef<'ol'>) {
  return (
    <ol
      className="mt-4 list-decimal space-y-2 pl-5 marker:text-nham-text-muted marker:tabular-nums"
      {...props}
    />
  );
}

export function DocsListItem(props: ComponentPropsWithoutRef<'li'>) {
  return (
    <li className="pl-1 text-base text-nham-text leading-[1.75]" {...props} />
  );
}

export function DocsStrong(props: ComponentPropsWithoutRef<'strong'>) {
  return <strong className="font-semibold text-nham-text" {...props} />;
}

/**
 * Lora italic at 300 in tan is the house accent treatment — here it carries
 * pull-quotes and the "useful uncertainty" asides.
 */
export function DocsBlockquote(props: ComponentPropsWithoutRef<'blockquote'>) {
  return (
    <blockquote
      className="mt-6 border-nham-accent border-l-2 pl-5 font-serif text-base text-nham-text italic leading-relaxed"
      {...props}
    />
  );
}

export function DocsHr(props: ComponentPropsWithoutRef<'hr'>) {
  return <hr className="my-12 border-nham-border border-t" {...props} />;
}
