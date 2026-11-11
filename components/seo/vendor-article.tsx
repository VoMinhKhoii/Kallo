import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';
import { LazyAuthDialog } from '@/components/auth/lazy-auth-dialog';
import { AuthRequestConfig } from '@/components/auth/request-config/auth-request-config';
import { DocsParagraph } from '@/components/docs/mdx/prose';
import { TryItButton } from '@/components/seo/food-page/try-it-button';
import { JsonLd } from '@/components/seo/json-ld';
import { ALTERNATIVES_CHROME } from '@/lib/seo/alternatives/chrome';
import { alternativesStructuredData } from '@/lib/seo/page-structured-data';

/**
 * The shell every page about other apps shares (alternatives and "Kallo vs"):
 * the dated JSON-LD, the title, the answer and the disclosure up top, then the
 * page's own body, then the try-it line and button. Rendered without
 * `<Suspense>` around the article, so crawlers that run no JavaScript read it.
 */
export async function VendorArticle({
  locale,
  url,
  title,
  description,
  publishedOn,
  checkedOn,
  answer,
  disclosure,
  tryLine,
  children,
}: {
  locale: string;
  url: string;
  title: string;
  description: string;
  publishedOn: string;
  checkedOn: string;
  answer: string;
  disclosure: string;
  tryLine: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations({ locale, namespace: 'landing.header' });
  return (
    <AuthProvider>
      <JsonLd
        data={alternativesStructuredData({
          locale,
          url,
          title,
          description,
          publishedOn,
          checkedOn,
        })}
      />
      <article className="mx-auto w-full min-w-0 max-w-[40rem] py-10">
        <div className="mt-3 text-center">
          <h1 className="text-balance font-bold font-serif text-h1 text-kallo-text">
            {title}
          </h1>
          <p className="mt-3 text-kallo-text-muted text-sm">
            {ALTERNATIVES_CHROME.checked(checkedOn)}
          </p>
        </div>

        <hr className="mt-8 border-kallo-text border-t" />

        <div className="mt-10">
          <DocsParagraph>{answer}</DocsParagraph>
          <p className="mt-4 text-kallo-text-muted text-sm leading-[1.75]">
            {disclosure}
          </p>

          {children}

          <div className="mt-16 border-kallo-text border-t pt-10 text-center">
            <DocsParagraph>{tryLine}</DocsParagraph>
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
