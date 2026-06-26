export default function SettingsLoading() {
  return (
    <div
      className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-5 sm:py-8"
      aria-busy="true"
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      <p
        className="text-nham-text-muted text-sm"
        style={{ fontFamily: 'Lora, serif' }}
      >
        Opening your settings…
      </p>
      <div className="mt-5 flex flex-col gap-3 motion-safe:animate-pulse">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between gap-4 rounded-2xl border border-nham-border/60 bg-white px-4 py-4"
          >
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-32 rounded-full bg-nham-track" />
              <div className="h-3 w-56 rounded-full bg-nham-track" />
            </div>
            <div className="h-8 w-20 shrink-0 rounded-xl bg-nham-track" />
          </div>
        ))}
      </div>
    </div>
  );
}
