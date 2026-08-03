import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DocsHubSection } from '@/components/docs/docs-hub-section';
import type { Locale } from '@/i18n/config';
import { routing } from '@/i18n/navigation';
import { getDocsTree } from '@/lib/docs/tree';
import { SITE_URL } from '@/lib/site';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'docs.hub' });
  const url = `${SITE_URL}/${locale}/docs`;

  const title = `${t('title')} ${t('titleAccent')}`;

  return {
    title: `${title} — Kallo`,
    description: t('subtitle'),
    alternates: { canonical: url },
    openGraph: { url, title, description: t('subtitle') },
  };
}

export default async function DocsHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('docs.hub');
  const sections = await getDocsTree(locale as Locale);

  return (
    <div className="max-w-[45rem] py-14">
      {/* The signature headline treatment: second clause in Lora italic 300,
          tan. One per surface. */}
      <h1 className="text-balance font-normal font-serif text-h1 text-nham-text">
        {t('title')} <span className="italic-accent">{t('titleAccent')}</span>
      </h1>
      <p className="mt-5 max-w-2xl text-pretty text-[17px] text-nham-text-soft leading-relaxed">
        {t('subtitle')}
      </p>

      <div className="mt-16 space-y-14">
        {sections.map((section) => (
          <DocsHubSection key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
