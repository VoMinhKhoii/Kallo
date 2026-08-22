import { getTranslations } from 'next-intl/server';

export default async function AdminLoading() {
  const t = await getTranslations('common');
  return (
    <div
      className="space-y-4 motion-safe:animate-pulse"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={t('loading')}
    >
      {/* Header bar — title + right-side meta */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-48 rounded-md bg-kallo-track" />
        <div className="h-4 w-32 rounded-md bg-kallo-track" />
      </div>

      {/* Filters row */}
      <div className="h-10 w-full rounded-md bg-kallo-track" />

      {/* Content rows */}
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-12 w-full rounded-md bg-kallo-track" />
        ))}
      </div>
    </div>
  );
}
