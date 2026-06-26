import { CircleWallSkeleton } from '@/components/groups/circle-wall-skeleton';

export default function GroupsLoading() {
  return (
    <main className="flex-1 px-5 py-6 sm:px-8 lg:px-12" aria-busy="true">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        {/* Header band — mirrors groups/page.tsx */}
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p
              className="text-nham-text-muted text-sm"
              style={{ fontFamily: 'Lora, serif' }}
            >
              Gathering your circle…
            </p>
            <div className="h-3 w-48 rounded-full bg-nham-track motion-safe:animate-pulse" />
          </div>
          <div className="h-9 w-28 shrink-0 rounded-xl bg-nham-track motion-safe:animate-pulse" />
        </header>

        <CircleWallSkeleton />
      </div>
    </main>
  );
}
