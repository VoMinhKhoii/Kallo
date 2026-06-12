'use client';

import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useAuthDialog } from '@/components/auth/auth-provider';
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
          <h2
            className="mb-6 font-normal text-5xl text-[#2C2416] leading-tight lg:text-6xl"
            style={{ fontFamily: 'var(--font-lora), Georgia, serif' }}
          >
            {t('title')}
          </h2>

          <p
            className="mx-auto mb-12 max-w-2xl text-[#6B5D4F] text-xl leading-relaxed"
            style={{
              fontFamily:
                'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
            }}
          >
            {t('subtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="mb-12 flex flex-wrap justify-center gap-4">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="landing-primary"
                size="landing"
                style={{
                  fontFamily:
                    'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
                }}
                onClick={() => openDialog('sign-up')}
              >
                {t('button')}
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="landing-secondary"
                size="landing"
                style={{
                  fontFamily:
                    'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
                }}
              >
                {t('buttonSecondary')}
              </Button>
            </motion.div>
          </div>

          {/* Features */}
          <div className="mb-16 flex flex-wrap justify-center gap-8 text-[#8B7355] text-sm">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[#C9A87C]" />
              <span
                style={{
                  fontFamily:
                    'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
                }}
              >
                {t('feature1')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[#C9A87C]" />
              <span
                style={{
                  fontFamily:
                    'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
                }}
              >
                {t('feature2')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[#C9A87C]" />
              <span
                style={{
                  fontFamily:
                    'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
                }}
              >
                {t('feature3')}
              </span>
            </div>
          </div>

          {/* Trust line — only true, verifiable facts. The product is launching;
              it has no ratings or user counts to claim. */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="border-[#E8D5B5]/30 border-t pt-12"
          >
            <p
              className="text-[#8B7355] text-sm"
              style={{
                fontFamily:
                  'var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif',
              }}
            >
              {t('trust')}
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
