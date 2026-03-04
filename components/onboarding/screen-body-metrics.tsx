'use client';

// Stub — full implementation in Task 2
export function ScreenBodyMetrics({
  defaultValues: _defaultValues,
  onChange: _onChange,
}: {
  defaultValues: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  return (
    <div className="p-8 text-center text-muted-foreground">
      Screen 1 loading...
    </div>
  );
}
