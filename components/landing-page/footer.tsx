import { getTranslations } from 'next-intl/server';

export async function Footer() {
  const t = await getTranslations('landing.footer');

  return (
    <footer className="relative border-nham-border/30 border-t bg-nham-surface">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-12 grid gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-3">
            <div className="mb-4 font-medium font-serif text-2xl text-nham-text">
              Nhẩm
            </div>
            <p className="max-w-sm font-sans-display text-nham-text-soft leading-relaxed">
              {t('tagline')}
            </p>
          </div>

          {/* Product — real in-page anchors. The dead Company/legal columns
              (about/blog/contact/faq/terms/privacy/security) are removed, not
              parked on href="#"; no such pages exist to honestly link to. */}
          <div>
            <h4 className="mb-4 font-medium font-sans-display text-nham-text">
              {t('product')}
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="#features"
                  className="font-sans-display text-nham-text-soft text-sm transition-colors hover:text-nham-text"
                >
                  {t('features')}
                </a>
              </li>
              <li>
                <a
                  href="#how"
                  className="font-sans-display text-nham-text-soft text-sm transition-colors hover:text-nham-text"
                >
                  {t('howItWorks')}
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="font-sans-display text-nham-text-soft text-sm transition-colors hover:text-nham-text"
                >
                  {t('pricing')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-nham-border/30 border-t pt-8 md:flex-row">
          <p className="font-sans-display text-nham-text-muted text-sm">
            {t('copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}
