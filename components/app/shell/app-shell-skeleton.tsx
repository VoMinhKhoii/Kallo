import { getTranslations } from 'next-intl/server';

/**
 * The authenticated shell's static stand-in.
 *
 * Under Cache Components the `(app)` layout reads the Supabase session behind
 * a `<Suspense>` boundary, and this is its fallback — so it is what a direct
 * visit to any app route paints first, straight from the prerendered HTML,
 * while the session, the profile and the page stream in. It mirrors the real
 * `AppShell` frame (viewport-pinned canvas, the desktop sidebar card, the
 * content column) so the swap does not shift the layout. It knows nothing
 * about the user, which is what lets it be static.
 */
export async function AppShellSkeleton() {
  const t = await getTranslations('common');

  return (
    <div
      className="fixed inset-0 flex min-w-0 overflow-clip bg-kallo-surface"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={t('loading')}
    >
      <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-x-clip p-3">
        <div className="hidden md:block">
          <div className="flex h-full w-[260px] shrink-0 flex-col gap-3 rounded-xl border border-kallo-border/60 bg-white p-3 shadow-kallo-text/[0.03] shadow-sm">
            <div className="h-5 w-24 rounded-md bg-kallo-track motion-safe:animate-pulse" />
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="h-9 w-full rounded-lg bg-kallo-track/70 motion-safe:animate-pulse"
              />
            ))}
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-2 motion-safe:animate-pulse">
          <div className="h-8 w-40 rounded-lg bg-kallo-track md:hidden" />
          <div className="h-6 w-56 rounded-md bg-kallo-track" />
          <div className="h-40 w-full rounded-[1.375rem] bg-kallo-track/70" />
          <div className="h-64 w-full rounded-[1.375rem] bg-kallo-track/50" />
        </div>
      </div>
    </div>
  );
}
