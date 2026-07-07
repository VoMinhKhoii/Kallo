import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import {
  FEEDBACK_TYPE_LABELS,
  getFeedbackDetail,
} from '@/lib/admin/feedback-queries';
import { formatUtcTimestamp } from '@/lib/admin/format';
import { requireAdmin } from '@/lib/admin/require-admin';
import { db } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';
import { cn } from '@/lib/utils';
import { StatusForm } from './_components/status-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Feedback · Nhẩm Admin',
  robots: { index: false, follow: false },
};

const TYPE_STYLES: Record<string, string> = {
  bug: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  ingredient:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  idea: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="break-all text-sm">{value ?? '—'}</dd>
    </div>
  );
}

export default async function AdminFeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const row = await getFeedbackDetail(db, id);
  if (!row) notFound();

  const admin = createAdminClient();

  // Screenshots live in a private bucket; mint a short-lived signed URL.
  let screenshotUrl: string | null = null;
  if (row.screenshotPath) {
    const { data } = await admin.storage
      .from('feedback-screenshots')
      .createSignedUrl(row.screenshotPath, 300);
    screenshotUrl = data?.signedUrl ?? null;
  }

  // Resolve the submitter's email so triage doesn't require a separate lookup.
  const { data: userData } = await admin.auth.admin.getUserById(row.userId);
  const userEmail = userData?.user?.email ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/feedback"
        className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to feedback
      </Link>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex rounded px-1.5 py-0.5 font-medium text-xs',
              TYPE_STYLES[row.type] ?? 'bg-muted text-foreground'
            )}
          >
            {FEEDBACK_TYPE_LABELS[row.type] ?? row.type}
          </span>
        </div>
        <StatusForm id={row.id} current={row.status} />
      </div>

      <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm">
        {row.message}
      </div>

      {screenshotUrl && (
        <div>
          <p className="mb-2 text-muted-foreground text-xs">Screenshot</p>
          {/* biome-ignore lint/performance/noImgElement: admin-only preview of a short-lived signed URL with unknown dimensions; next/image adds no value here. */}
          <img
            src={screenshotUrl}
            alt="Feedback screenshot"
            className="max-h-[480px] w-auto rounded-lg border"
          />
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-3">
        <Field label="User" value={userEmail} />
        <Field
          label="User ID"
          value={<span className="font-mono text-xs">{row.userId}</span>}
        />
        <Field label="Platform" value={row.platform} />
        <Field label="App version" value={row.appVersion} />
        <Field label="Locale" value={row.locale} />
        <Field label="Route" value={row.route} />
        <Field label="Created" value={formatUtcTimestamp(row.createdAt)} />
        <Field label="Updated" value={formatUtcTimestamp(row.updatedAt)} />
      </dl>

      {row.metadata != null && (
        <div>
          <p className="mb-2 text-muted-foreground text-xs">Metadata</p>
          <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-4 text-xs">
            {JSON.stringify(row.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
