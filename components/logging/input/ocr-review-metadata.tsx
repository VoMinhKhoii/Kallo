interface OcrReviewMetadataProps {
  basis: string;
  confidence: string;
  servingDescription: string | null;
  servingsPerContainer: number | null;
  basisLabel: string;
  confidenceLabel: string;
  servingLabel: string;
  servingsPerContainerLabel: string;
}

export function OcrReviewMetadata(props: OcrReviewMetadataProps) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 rounded-xl border border-nham-border bg-white p-3 text-[12px]">
      <dt className="text-nham-text-muted">{props.basisLabel}</dt>
      <dd className="font-medium text-nham-text">{props.basis}</dd>
      <dt className="text-nham-text-muted">{props.confidenceLabel}</dt>
      <dd className="font-medium text-nham-text">{props.confidence}</dd>
      {props.servingDescription && (
        <>
          <dt className="text-nham-text-muted">{props.servingLabel}</dt>
          <dd className="font-medium text-nham-text">
            {props.servingDescription}
          </dd>
        </>
      )}
      {props.servingsPerContainer !== null && (
        <>
          <dt className="text-nham-text-muted">
            {props.servingsPerContainerLabel}
          </dt>
          <dd className="font-medium text-nham-text">
            {props.servingsPerContainer}
          </dd>
        </>
      )}
    </dl>
  );
}
