import { getTranslations } from 'next-intl/server';

export async function Footer() {
  const t = await getTranslations('landing.footer');

  return (
    <footer className="relative border-[#E8D5B5]/30 border-t bg-[#FEFBF6]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-12 grid gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-3">
            <div className="mb-4 font-medium font-serif text-2xl text-[#2C2416]">
              Nhẩm
            </div>
            <p className="max-w-sm font-sans-display text-[#6B5D4F] leading-relaxed">
              {t('tagline')}
            </p>
          </div>

          {/* Product — real in-page anchors. The dead Company/legal columns
              (about/blog/contact/faq/terms/privacy/security) are removed, not
              parked on href="#"; no such pages exist to honestly link to. */}
          <div>
            <h4 className="mb-4 font-medium font-sans-display text-[#2C2416]">
              {t('product')}
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="#features"
                  className="font-sans-display text-[#6B5D4F] text-sm transition-colors hover:text-[#2C2416]"
                >
                  {t('features')}
                </a>
              </li>
              <li>
                <a
                  href="#how"
                  className="font-sans-display text-[#6B5D4F] text-sm transition-colors hover:text-[#2C2416]"
                >
                  {t('howItWorks')}
                </a>
              </li>
              <li>
                <a
                  href="#pricing"
                  className="font-sans-display text-[#6B5D4F] text-sm transition-colors hover:text-[#2C2416]"
                >
                  {t('pricing')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-[#E8D5B5]/30 border-t pt-8 md:flex-row">
          <p className="font-sans-display text-[#8B7355] text-sm">
            {t('copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}
