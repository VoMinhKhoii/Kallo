import { MoreLink } from './more-link';

/**
 * One run of text under a card: a heavier lead, then the rest. With `href` the
 * lead opens the page that explains the feature.
 */
export function CardCaption({
  lead,
  rest,
  href,
}: {
  lead: string;
  rest: string;
  href?: string;
}) {
  return (
    <p className="mt-5 font-sans-display text-kallo-text text-xl leading-[1.375] tracking-[-0.025em]">
      {href ? (
        <MoreLink href={href} className="font-semibold">
          {lead}
        </MoreLink>
      ) : (
        <span className="font-semibold">{lead}</span>
      )}{' '}
      {rest}
    </p>
  );
}
