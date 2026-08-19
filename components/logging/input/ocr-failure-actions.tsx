'use client';

interface OcrFailureActionsProps {
  message: string;
  retryText: string;
  manualText: string;
  isProcessing: boolean;
  onRetry: () => void;
  /** Omitted while manual nutrition entry is not offered — then the card
   *  shows retry alone rather than a button that goes nowhere. */
  onManualEntry?: () => void;
}

export function OcrFailureActions(props: OcrFailureActionsProps) {
  return (
    <div
      role="alert"
      className="space-y-3 rounded-xl bg-nham-danger/10 p-3 text-[12px] text-nham-danger leading-snug"
    >
      <p>{props.message}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={props.onRetry}
          disabled={props.isProcessing}
          className="rounded-lg border border-nham-danger/30 bg-white px-3 py-1.5 font-medium text-nham-danger text-xs"
        >
          {props.retryText}
        </button>
        {props.onManualEntry && (
          <button
            type="button"
            onClick={props.onManualEntry}
            className="rounded-lg bg-nham-ink px-3 py-1.5 font-medium text-white text-xs"
          >
            {props.manualText}
          </button>
        )}
      </div>
    </div>
  );
}
