import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';
import { LazyAuthDialog } from '@/components/auth/lazy-auth-dialog';
import { AuthRequestConfig } from '@/components/auth/request-config/auth-request-config';
import {
  DocsH2,
  DocsLink,
  DocsListItem,
  DocsParagraph,
  DocsUnorderedList,
} from '@/components/docs/mdx/prose';
import { FoodLinkList } from '@/components/seo/food-page/food-link-list';
import { TryItButton } from '@/components/seo/food-page/try-it-button';
import { ToolCalculator } from '@/components/seo/tools/tool-calculator';
import { ToolLinkList } from '@/components/seo/tools/tool-link-list';
import { isLocale, locales } from '@/i18n/config';
import { alternateLanguages } from '@/lib/seo/alternates';
import { FOOD_PAGE_CHROME } from '@/lib/seo/food-pages/page-copy';
import { FOOD_PAGES } from '@/lib/seo/food-pages/pages';
import { FOOD_PAGE_PREFIX, FOOD_SLUGS } from '@/lib/seo/food-pages/slugs';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { SITE_URL } from '@/lib/seo/site';
import { HUB_COPY, TOOL_COPY, TOOL_UI } from '@/lib/seo/tools/content';
import {
  TOOL_EXAMPLE_COPY,
  TOOL_EXAMPLE_MEALS,
} from '@/lib/seo/tools/example-meals';
import {
  isToolSlug,
  TOOL_SLUGS,
  TOOLS_PREFIX,
  toolPath,
} from '@/lib/seo/tools/slugs';

/**
 * A calculator page: the calculator (a client component that opens on the
 * page's worked example) above an article that explains the number, readable
 * without JS. Copy lives in `lib/seo/tools/copy/<locale>/`.
 *
 * An unknown slug gets its real 404 from the proxy (`unknownToolPageTarget`);
 * `notFound()` here is the backstop.
 */
interface ToolPageProps {
  params: Promise<{ locale: string; tool: string }>;
}

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    TOOL_SLUGS.map((tool) => ({ locale, tool }))
  );
}

export async function generateMetadata({
  params,
}: ToolPageProps): Promise<Metadata> {
  const { locale, tool } = await params;
  if (!isLocale(locale) || !isToolSlug(tool)) return {};
  const copy = TOOL_COPY[locale][tool];
  const url = `${SITE_URL}/${locale}${toolPath(tool)}`;
  return {
    title: copy.metaTitle,
    description: copy.description,
    alternates: {
      canonical: url,
      languages: alternateLanguages(toolPath(tool)),
    },
    openGraph: {
      ...SHARED_OPEN_GRAPH,
      url,
      title: copy.metaTitle,
      description: copy.description,
    },
  };
}

export default function ToolPage({ params }: ToolPageProps) {
  return (
    <Suspense fallback={null}>
      <ToolContent params={params} />
    </Suspense>
  );
}

async function ToolContent({ params }: ToolPageProps) {
  const { locale, tool } = await params;
  if (!isLocale(locale) || !isToolSlug(tool)) notFound();
  const copy = TOOL_COPY[locale][tool];
  const hub = HUB_COPY[locale];
  const examples = TOOL_EXAMPLE_COPY[locale];
  const browse = FOOD_PAGE_CHROME[locale].browse;
  const t = await getTranslations({ locale, namespace: 'landing.header' });

  return (
    <AuthProvider>
      <article className="mx-auto w-full min-w-0 max-w-[40rem] py-10">
        <div className="mt-3 text-center">
          <h1 className="text-balance font-bold font-serif text-h1 text-kallo-text">
            {copy.title}
          </h1>
        </div>

        <hr className="mt-8 border-kallo-text border-t" />

        <div className="mt-10">
          <DocsParagraph>{copy.lead}</DocsParagraph>

          <section className="mt-8">
            <ToolCalculator locale={locale} slug={tool} ui={TOOL_UI[locale]} />
          </section>

          {copy.sections.map((section) => (
            <section key={section.heading}>
              <DocsH2>{section.heading}</DocsH2>
              {section.paragraphs.map((p) => (
                <DocsParagraph key={p.slice(0, 40)}>{p}</DocsParagraph>
              ))}
            </section>
          ))}

          <DocsH2>{examples.heading}</DocsH2>
          <DocsParagraph>{examples.lead}</DocsParagraph>
          <FoodLinkList
            pages={TOOL_EXAMPLE_MEALS[locale][tool].map(
              (slug) => FOOD_PAGES[slug]
            )}
          />
          <DocsParagraph>
            {browse.before}
            <DocsLink href={FOOD_PAGE_PREFIX}>
              {browse.link(FOOD_SLUGS[locale].length)}
            </DocsLink>
            {browse.after}
          </DocsParagraph>

          <DocsH2>{hub.sourcesHeading}</DocsH2>
          <DocsUnorderedList>
            {copy.sources.map((s) => (
              <DocsListItem key={s.href}>
                <DocsLink href={s.href}>{s.label}</DocsLink>
              </DocsListItem>
            ))}
          </DocsUnorderedList>

          <DocsH2>{hub.more}</DocsH2>
          <ToolLinkList
            locale={locale}
            slugs={TOOL_SLUGS.filter((s) => s !== tool)}
          />
          <DocsParagraph>
            <DocsLink href={TOOLS_PREFIX}>{hub.title}</DocsLink>
          </DocsParagraph>

          <div className="mt-16 border-kallo-text border-t pt-10 text-center">
            <DocsParagraph>{hub.tryLine}</DocsParagraph>
            <div className="mt-6">
              <TryItButton>{t('getStarted')}</TryItButton>
            </div>
          </div>
        </div>
      </article>
      <LazyAuthDialog />
      <Suspense fallback={null}>
        <AuthRequestConfig />
      </Suspense>
    </AuthProvider>
  );
}
