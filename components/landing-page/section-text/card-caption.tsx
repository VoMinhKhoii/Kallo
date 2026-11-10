import { MoreLink } from './more-link';

/**
 * One run of text under a card: a heavier lead, then the rest. With `href` the
 * whole caption opens the page that explains the feature, arrow at the end.
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
        <MoreLink href={href} lead={lead} text={rest} />
      ) : (
        <>
          <span className="font-semibold">{lead}</span> {rest}
        </>
      )}
    </p>
  );
}
