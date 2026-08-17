'use client';

interface OcrFailureActionsProps {
  message: string;
  retryText: string;
  manualText: string;
  isProcessing: boolean;
  onRetry: () => void;
  onManualEntry: () => void;
}

export function OcrFailureActions(props: OcrFailureActionsProps) {
  return (
    <div
      role="alert"
      className="space-y-3 rounded-xl bg-kallo-danger/10 p-3 text-[13px] text-kallo-danger leading-snug"
    >
      <p>{props.message}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={props.onRetry}
          disabled={props.isProcessing}
          className="rounded-lg border border-kallo-danger/30 bg-white px-3 py-1.5 font-medium text-kallo-danger text-xs"
        >
          {props.retryText}
        </button>
        <button
          type="button"
          onClick={props.onManualEntry}
          className="rounded-lg bg-kallo-ink px-3 py-1.5 font-medium text-white text-xs"
        >
          {props.manualText}
        </button>
      </div>
    </div>
  );
}
