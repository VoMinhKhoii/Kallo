import { getTranslations } from 'next-intl/server';

/**
 * The revision stamp under a page title. Legal documents need it, and the
 * feature guides carry it once they start describing behaviour that changes.
 *
 * The date is a hand-written `YYYY-MM-DD` in frontmatter — never derived from
 * git, so reformatting a file cannot silently restamp a policy. It is rendered
 * inside a `<time>` with the machine-readable value intact and a
 * locale-formatted face.
 */
export async function LastUpdated({
  date,
  locale,
}: {
  date: string;
  locale: string;
}) {
  const t = await getTranslations('docs');

  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;

  const formatted = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);

  return (
    <p className="mt-4 font-sans-display text-[12px] text-nham-text-muted">
      <time dateTime={date}>{t('lastUpdated', { date: formatted })}</time>
    </p>
  );
}
