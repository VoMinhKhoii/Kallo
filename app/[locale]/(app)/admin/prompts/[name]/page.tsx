import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Link } from '@/i18n/navigation';
import { formatUtcTimestamp } from '@/lib/admin/format';
import { getPromptVersions } from '@/lib/admin/queries';
import { requireAdmin } from '@/lib/admin/require-admin';
import { db } from '@/lib/db';
import { VersionDiff } from './_components/version-diff';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ name: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PromptDetailPage({
  params,
  searchParams,
}: PageProps) {
  await requireAdmin();

  const { name } = await params;
  const sp = await searchParams;

  let decodedName: string;
  try {
    decodedName = decodeURIComponent(name);
  } catch {
    notFound();
  }
  if (!decodedName) notFound();
  const compareId = typeof sp.compare === 'string' ? sp.compare : undefined;
  if (compareId && !z.string().uuid().safeParse(compareId).success) notFound();
  const withId = typeof sp.with === 'string' ? sp.with : undefined;
  if (withId && !z.string().uuid().safeParse(withId).success) notFound();

  const versions = await getPromptVersions(db, decodedName);

  if (versions.length === 0) notFound();

  // Resolve compare versions if requested
  const vA = compareId ? versions.find((v) => v.id === compareId) : undefined;
  const vB = withId ? versions.find((v) => v.id === withId) : undefined;

  const isCompare = Boolean(vA && vB);

  return (
    <div className="mx-auto max-w-4xl space-y-6 font-sans-display">
      {/* Back link */}
      <div>
        <Link
          href="/admin/prompts"
          className="inline-flex items-center gap-1 text-nham-text-muted text-sm transition-colors hover:text-nham-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Prompts
        </Link>
      </div>

      <div>
        <h1 className="break-all font-bold font-mono text-2xl text-nham-text">
          {decodedName}
        </h1>
        <p className="mt-1 text-nham-text-muted text-sm">
          {versions.length} version{versions.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Diff panel */}
      {isCompare && vA && vB && (
        <div className="rounded-lg border border-nham-border/60 bg-white/50 p-5 dark:bg-white/[0.02]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-nham-text">Diff</h2>
            <Link
              href={`/admin/prompts/${name}`}
              className="text-nham-text-muted text-xs hover:underline"
            >
              Exit compare
            </Link>
          </div>
          <VersionDiff
            labelA={vA.codeHash.slice(0, 8)}
            sampleA={vA.templateSample}
            labelB={vB.codeHash.slice(0, 8)}
            sampleB={vB.templateSample}
          />
        </div>
      )}

      {/* Versions table */}
      <div className="overflow-hidden rounded-lg border border-nham-border/60 bg-white/50 dark:bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="border-nham-border/60 border-b bg-nham-track/50">
            <tr className="text-nham-text-muted">
              <th className="px-4 py-2.5 text-left font-medium">Code hash</th>
              <th className="px-4 py-2.5 text-left font-medium">Model</th>
              <th className="px-4 py-2.5 text-left font-medium">Git SHA</th>
              <th className="px-4 py-2.5 text-left font-medium">First seen</th>
              <th className="px-4 py-2.5 text-left font-medium">Compare</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nham-border/40">
            {versions.map((v) => {
              const isSelected = v.id === compareId || v.id === withId;
              return (
                <tr
                  key={v.id}
                  className={
                    isSelected ? 'bg-nham-accent/10' : 'hover:bg-nham-hover/50'
                  }
                >
                  <td className="px-4 py-2.5 font-mono text-nham-text">
                    {v.codeHash.slice(0, 12)}
                  </td>
                  <td className="px-4 py-2.5 text-nham-text-muted">
                    {v.model}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-nham-text-muted">
                    {v.gitSha ? v.gitSha.slice(0, 8) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-nham-text-muted tabular-nums">
                    {formatUtcTimestamp(v.firstSeenAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <CompareLink
                      href={`/admin/prompts/${name}`}
                      versionId={v.id}
                      currentCompare={compareId}
                      currentWith={withId}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Renders a compare link that toggles compare/with query params. */
function CompareLink({
  href,
  versionId,
  currentCompare,
  currentWith,
}: {
  href: string;
  versionId: string;
  currentCompare: string | undefined;
  currentWith: string | undefined;
}) {
  // If neither slot filled — pick as base
  if (!currentCompare) {
    return (
      <Link
        href={`${href}?compare=${versionId}`}
        className="text-nham-accent text-xs hover:underline"
      >
        Select A
      </Link>
    );
  }

  // Base filled, no target — pick as target (unless this IS the base)
  if (versionId === currentCompare) {
    return (
      <Link
        href={href}
        className="text-nham-text-muted text-xs hover:underline"
      >
        Clear A
      </Link>
    );
  }

  if (!currentWith) {
    return (
      <Link
        href={`${href}?compare=${currentCompare}&with=${versionId}`}
        className="text-nham-accent text-xs hover:underline"
      >
        Compare with A
      </Link>
    );
  }

  // Both filled — clicking another clears and starts fresh
  if (versionId === currentWith) {
    return (
      <Link
        href={`${href}?compare=${currentCompare}`}
        className="text-nham-text-muted text-xs hover:underline"
      >
        Clear B
      </Link>
    );
  }

  return (
    <Link
      href={`${href}?compare=${currentCompare}&with=${versionId}`}
      className="text-nham-accent text-xs hover:underline"
    >
      Compare with A
    </Link>
  );
}
