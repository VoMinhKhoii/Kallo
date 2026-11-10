import { MoreLink } from './more-link';

/**
 * One run of text under a demo card: a heavier lead, then the rest, linking to
 * the docs page that explains the feature. The link stretches over the card,
 * so the card's `li` must be positioned.
 */
export function CardCaption({
  lead,
  rest,
  doc,
}: {
  lead: string;
  rest: string;
  /** A docs slug, e.g. `logging/barcode`. */
  doc: string;
}) {
  return (
    <p className="mt-5 font-sans-display text-kallo-text text-xl leading-[1.375] tracking-[-0.025em]">
      <MoreLink href={`/docs/${doc}`} lead={lead} text={rest} stretch />
    </p>
  );
}
