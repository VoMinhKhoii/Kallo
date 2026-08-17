'use client';

import { Check, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAcceptInvite } from '@/hooks/social/circle/use-invite';
import { Link } from '@/i18n/navigation';

interface ConnectPanelProps {
  slug: string;
  inviterLabel: string;
  youLabel: string;
}

/**
 * The full Connect state, resolved IN PLACE. Before accepting: the inviter's
 * disc, the "Connect with {name}" title, and the Accept button. On success the
 * recipient's disc slides in beside the inviter's, the title crossfades to
 * "You're connected", and going to the circle becomes a choice — no teleport to
 * a (usually empty) /groups at the moment of commitment.
 */
export function ConnectPanel({
  slug,
  inviterLabel,
  youLabel,
}: ConnectPanelProps) {
  const t = useTranslations('groups.connect');
  const accept = useAcceptInvite();
  const [connected, setConnected] = useState(false);

  const onAccept = () => {
    accept.mutate(slug, {
      onSuccess: () => setConnected(true),
      onError: () => toast.error(t('error')),
    });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-kallo-surface px-5 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        {/* Discs: inviter alone, then the recipient's slides in beside it. */}
        <div className="flex items-center justify-center gap-2">
          <Disc label={inviterLabel} />
          <AnimatePresence>
            {connected ? (
              <motion.div
                key="you"
                initial={{ opacity: 0, x: -14, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              >
                <Disc label={youLabel} highlighted />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="wait">
            <motion.h1
              key={connected ? 'connected' : 'connect'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="font-normal font-serif text-2xl text-kallo-text tracking-tight"
            >
              {connected
                ? t('connectedTitle')
                : t('connectTitle', { name: inviterLabel })}
            </motion.h1>
          </AnimatePresence>
          <p className="font-sans-display text-kallo-text-muted text-sm leading-relaxed">
            {connected ? t('connectedBody') : t('connectBody')}
          </p>
        </div>

        {connected ? (
          <Link
            href="/circle"
            className="inline-flex items-center justify-center rounded-xl border border-kallo-border/60 bg-white px-6 py-3 font-medium font-sans-display text-[15px] text-kallo-text transition-colors hover:border-kallo-accent/50"
          >
            {t('goToCircle')}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAccept}
            disabled={accept.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-kallo-btn px-6 py-3 font-medium font-sans-display text-[15px] text-white shadow-kallo-btn/20 shadow-sm transition-colors hover:bg-kallo-btn/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accept.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {t('accept')}
          </button>
        )}
      </div>
    </main>
  );
}

function Disc({
  label,
  highlighted,
}: {
  label: string;
  highlighted?: boolean;
}) {
  return (
    <span
      className={
        highlighted
          ? 'flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-kallo-accent/55 to-kallo-border/60 ring-2 ring-kallo-accent/40'
          : 'flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-kallo-accent/40 to-kallo-border/50 ring-1 ring-kallo-accent/25'
      }
    >
      <span className="font-bold font-sans-display text-kallo-btn text-xl">
        {label.charAt(0).toUpperCase()}
      </span>
    </span>
  );
}
