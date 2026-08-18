/**
 * What the scan says the numbers mean — one quiet line, not a table.
 *
 * It was four label/value rows in a filled card, which gave provenance more
 * weight than the figures it describes. Confidence is named only when it is
 * not high: "please check these" is worth a line; "we're confident" is the
 * state the user already assumes.
 */
export function OcrReviewMetadata({
  basis,
  confidence,
  servingDescription,
}: {
  basis: string;
  confidence: string | null;
  servingDescription: string | null;
}) {
  const parts = [basis, servingDescription, confidence].filter(Boolean);
  return (
    <p className="text-[12px] text-nham-text-muted">{parts.join(' · ')}</p>
  );
}
