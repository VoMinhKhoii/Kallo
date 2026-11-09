/** One run of text under a card: a heavier lead, then the rest. */
export function CardCaption({ lead, rest }: { lead: string; rest: string }) {
  return (
    <p className="mt-5 font-sans-display text-kallo-text text-xl leading-[1.375] tracking-[-0.025em]">
      <span className="font-semibold">{lead}</span> {rest}
    </p>
  );
}
