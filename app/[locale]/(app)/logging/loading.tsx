export default function LoggingLoading() {
  return (
    <div
      className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col gap-0 overflow-hidden md:h-full md:flex-row md:gap-3"
      aria-busy="true"
    >
      {/* Timeline sidebar — mirrors TimelineSidebar (hidden below md) */}
      <nav className="hidden h-full w-[252px] shrink-0 flex-col gap-3 overflow-hidden border-border/40 border-r py-3 pr-3 md:flex">
        <div className="h-3 w-20 rounded-full bg-kallo-track motion-safe:animate-pulse" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 7 }, (_, index) => (
            <div
              key={index}
              className="h-8 rounded-lg bg-kallo-track motion-safe:animate-pulse"
              style={{ width: `${88 - index * 4}%` }}
            />
          ))}
        </div>
      </nav>

      {/* Feed — mirrors FeedArea: centered timeline rail + pinned input bar */}
      <main className="flex min-w-0 flex-1 flex-col self-stretch overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3 sm:px-6 sm:py-4">
          <p className="mx-auto mb-6 w-full max-w-3xl pl-6 font-sans-display text-kallo-text-muted text-sm sm:pl-12">
            Pulling up your day…
          </p>
          <div className="mx-auto w-full max-w-3xl pl-6 sm:pl-12">
            <div className="flex flex-col gap-8 motion-safe:animate-pulse">
              {[0, 1].map((item) => (
                <div key={item} className="group relative">
                  <div className="absolute top-2 bottom-0 -left-10 w-px bg-kallo-border/50 group-last:bg-transparent" />
                  <div className="absolute top-2 -left-[43px] h-2 w-2 rounded-full border-2 border-kallo-accent/70 bg-kallo-surface" />
                  <div className="mb-2 h-3 w-16 rounded-full bg-kallo-border/70" />
                  <div className="rounded-2xl border border-kallo-border/60 bg-kallo-hover/20 p-5 shadow-sm">
                    <div className="mb-4 h-5 w-2/3 rounded-full bg-kallo-border/70" />
                    <div className="space-y-2">
                      <div className="h-3 w-full rounded-full bg-kallo-border/60" />
                      <div className="h-3 w-5/6 rounded-full bg-kallo-border/50" />
                      <div className="h-3 w-3/5 rounded-full bg-kallo-border/40" />
                    </div>
                    <div className="mt-5 flex items-center justify-between border-kallo-border/50 border-t border-dashed pt-3">
                      <div className="h-3 w-28 rounded-full bg-kallo-border/50" />
                      <div className="h-4 w-16 rounded-full bg-kallo-accent/25" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pinned input bar */}
        <div className="px-3 pb-3 sm:px-6 sm:pb-4">
          <div className="mx-auto h-14 w-full max-w-3xl rounded-2xl border border-kallo-border/60 bg-kallo-hover/20 motion-safe:animate-pulse" />
        </div>
      </main>
    </div>
  );
}
