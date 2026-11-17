import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsLink, DocsParagraph } from '@/components/docs/mdx/prose';
import { JsonLd } from '@/components/seo/json-ld';
import { ToolLinkList } from '@/components/seo/tools/tool-link-list';
import { isLocale, locales } from '@/i18n/config';
import { alternateLanguages } from '@/lib/seo/alternates';
import { FOOD_PAGE_PREFIX, isFoodLocale } from '@/lib/seo/food-pages/slugs';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { hubStructuredData } from '@/lib/seo/page-structured-data';
import { SITE_URL } from '@/lib/seo/site';
import { HUB_COPY, TOOL_COPY } from '@/lib/seo/tools/content';
import { TOOL_SLUGS, TOOLS_PREFIX } from '@/lib/seo/tools/slugs';

/** The calculators' index, in every locale. */
interface ToolsHubProps {
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: ToolsHubProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = HUB_COPY[locale];
  const url = `${SITE_URL}/${locale}${TOOLS_PREFIX}`;
  return {
    title: copy.metaTitle,
    description: copy.description,
    alternates: {
      canonical: url,
      languages: alternateLanguages(TOOLS_PREFIX),
    },
    openGraph: {
      ...SHARED_OPEN_GRAPH,
      url,
      title: copy.metaTitle,
      description: copy.description,
    },
  };
}

export default async function ToolsHub({ params }: ToolsHubProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = HUB_COPY[locale];

  return (
    <article className="mx-auto w-full min-w-0 max-w-[40rem] py-10">
      <JsonLd
        data={hubStructuredData({
          locale,
          name: copy.title,
          items: TOOL_SLUGS.map((slug) => ({
            name: TOOL_COPY[locale][slug].name,
            url: `${SITE_URL}/${locale}${TOOLS_PREFIX}/${slug}`,
          })),
        })}
      />
      <div className="mt-3 text-center">
        <h1 className="text-balance font-bold font-serif text-h1 text-kallo-text">
          {copy.title}
        </h1>
      </div>

      <hr className="mt-8 border-kallo-text border-t" />

      <div className="mt-10">
        <DocsParagraph>{copy.lead}</DocsParagraph>
        <ToolLinkList locale={locale} slugs={TOOL_SLUGS} />
        {copy.foodLine && isFoodLocale(locale) ? (
          <DocsParagraph>
            <DocsLink href={FOOD_PAGE_PREFIX}>{copy.foodLine}</DocsLink>
          </DocsParagraph>
        ) : null}
      </div>
    </article>
  );
}
