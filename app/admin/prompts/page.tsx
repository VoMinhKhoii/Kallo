import Link from 'next/link';
import { listPrompts } from '@/lib/admin/queries';
import { requireAdmin } from '@/lib/admin/require-admin';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function PromptsPage() {
  await requireAdmin();
  const prompts = await listPrompts(db);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="font-bold text-2xl">Prompts</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          All prompt templates tracked across pipeline runs.
        </p>
      </div>

      {prompts.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No prompt versions recorded yet.
        </p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Name</th>
                <th className="px-4 py-2 text-right font-semibold tabular-nums">
                  Versions
                </th>
                <th className="px-4 py-2 text-left font-semibold">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {prompts.map((p) => (
                <tr
                  key={p.name}
                  className="border-b last:border-b-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/prompts/${encodeURIComponent(p.name)}`}
                      className="font-medium font-mono hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {p.versionCount}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground tabular-nums">
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
