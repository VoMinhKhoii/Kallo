import { Loader2 } from 'lucide-react';

export default function AdminLoading() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center font-sans-display text-nham-text-muted"
      aria-busy="true"
      aria-live="polite"
    >
      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      <span>Loading…</span>
    </div>
  );
}
