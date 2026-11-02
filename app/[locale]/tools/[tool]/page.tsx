import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { AuthProvider } from '@/components/auth/auth-provider';
import { AuthRequestConfig } from '@/components/auth/request-config/auth-request-config';
import {
  DocsH2,
  DocsLink,
  DocsListItem,
  DocsParagraph,
  DocsUnorderedList,
} from '@/components/docs/mdx/prose';
import { TryItButton } from '@/components/seo/food-page/try-it-button';
import { ToolCalculator } from '@/components/seo/tools/tool-calculator';
import { ToolLinkList } from '@/components/seo/tools/tool-link-list';
import { type Locale, locales } from '@/i18n/config';
import { alternateLanguages } from '@/lib/seo/alternates';
import { SHARED_OPEN_GRAPH } from '@/lib/seo/open-graph';
import { SITE_URL } from '@/lib/seo/site';
import { HUB_COPY, TOOL_COPY, TOOL_UI } from '@/lib/seo/tools/content';
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

const isLocale = (l: string): l is Locale =>
  (locales as readonly string[]).includes(l);

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
      <AuthDialog />
      <Suspense fallback={null}>
        <AuthRequestConfig />
      </Suspense>
    </AuthProvider>
  );
}
