'use client';

import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useAuthDialog } from '@/components/auth/auth-provider';
import { scrollToAnchorId } from '@/components/landing-page/scroll-to-anchor';
import { Button } from '@/components/ui/button';

export function CTASection() {
  const t = useTranslations('landing.cta');
  const { openDialog } = useAuthDialog();
  return (
    <section id="pricing" className="relative bg-white py-32">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="mb-6 font-normal font-serif text-5xl text-nham-text leading-tight lg:text-6xl">
            {t('title')}
          </h2>

          <p className="mx-auto mb-12 max-w-2xl font-sans-display text-nham-text-soft text-xl leading-relaxed">
            {t('subtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="mb-12 flex flex-wrap justify-center gap-4">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="landing-primary"
                size="landing"
                className="font-sans-display"
                onClick={() => openDialog('sign-up')}
              >
                {t('button')}
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="landing-secondary"
                size="landing"
                className="font-sans-display"
                onClick={() => scrollToAnchorId('how')}
              >
                {t('buttonSecondary')}
              </Button>
            </motion.div>
          </div>

          {/* Features */}
          <div className="mb-16 flex flex-wrap justify-center gap-8 text-nham-text-muted text-sm">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-nham-text-muted" />
              <span className="font-sans-display">{t('feature1')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-nham-text-muted" />
              <span className="font-sans-display">{t('feature2')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-nham-text-muted" />
              <span className="font-sans-display">{t('feature3')}</span>
            </div>
          </div>

          {/* Trust line — only true, verifiable facts. The product is launching;
              it has no ratings or user counts to claim. */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="border-nham-border/30 border-t pt-12"
          >
            <p className="font-sans-display text-nham-text-muted text-sm">
              {t('trust')}
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
