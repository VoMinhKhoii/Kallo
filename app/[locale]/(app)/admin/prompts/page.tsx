import { Link } from '@/i18n/navigation';
import { listPrompts } from '@/lib/admin/queries';
import { requireAdmin } from '@/lib/admin/require-admin';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function PromptsPage() {
  await requireAdmin();
  const prompts = await listPrompts(db);

  return (
    <div className="mx-auto max-w-4xl space-y-6 font-sans-display">
      <div>
        <h1 className="font-bold font-lora text-2xl text-nham-text tracking-tight">
          Prompts
        </h1>
        <p className="mt-1 text-nham-text-muted text-sm">
          All prompt templates tracked across pipeline runs.
        </p>
      </div>

      {prompts.length === 0 ? (
        <p className="py-8 text-center text-nham-text-muted">
          No prompt versions recorded yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-nham-border/60 bg-white/50 dark:bg-white/[0.02]">
          <table className="w-full text-sm">
            <thead className="border-nham-border/60 border-b bg-nham-track/50">
              <tr className="text-nham-text-muted">
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-right font-medium tabular-nums">
                  Versions
                </th>
                <th className="px-4 py-2.5 text-left font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nham-border/40">
              {prompts.map((p) => (
                <tr className="hover:bg-nham-hover/50" key={p.name}>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/prompts/${encodeURIComponent(p.name)}`}
                      className="font-medium font-mono text-nham-accent hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right text-nham-text tabular-nums">
                    {p.versionCount}
                  </td>
                  <td className="px-4 py-2.5 text-nham-text-muted tabular-nums">
                    {new Date(p.latestSeenAt)
                      .toISOString()
                      .replace('T', ' ')
                      .slice(0, 19)}{' '}
                    UTC
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
