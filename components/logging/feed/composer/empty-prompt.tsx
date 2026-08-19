'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMyProfile } from '@/hooks/profile/use-profile';
import {
  EMPTY_ENTRANCE,
  ENTRANCE_EASE,
} from '@/lib/domain/logging/empty-entrance';
import { drawEmptyPromptKey } from '@/lib/domain/logging/empty-prompt';

/**
 * The first word to greet by, or null when we should stay impersonal.
 *
 * Long or multi-word labels collapse to the first word — "Time for lunch, Khoa"
 * reads like a person talking; the full legal name does not.
 */
function useFirstName(): string | null {
  // Never awaited: loading and error both surface as null, and the name-less
  // phrasing is already on screen by then.
  const { data } = useMyProfile();
  const label = data?.displayName?.trim();
  if (!label) return null;
  const first = label.split(/\s+/)[0];
  return !first || first.length > 16 ? null : first;
}

/**
 * The empty logging day's one editorial moment: a single serif question tuned
 * to the time of day, sitting above the composer. The rest of the surface is
 * sans-serif data.
 *
 * The web feed used to treat the input bar as the whole empty state, which read
 * as a form rather than as the app asking you something.
 */
export function EmptyPrompt() {
  const t = useTranslations('logging.emptyState');
  // Drawn ONCE: the display name lands a render or two later, and a prompt that
  // reshuffled at that moment would read as a glitch rather than a greeting.
  const [key] = useState(() => drawEmptyPromptKey(new Date().getHours()));
  const name = useFirstName();

  return (
    <motion.p
      // The last beat: it slides up into the space above the input, once the
      // input and the light under it have settled.
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: EMPTY_ENTRANCE.prompt,
        ease: ENTRANCE_EASE,
      }}
      className="relative z-10 mx-auto mb-5 max-w-3xl text-balance px-2 text-center font-serif text-[22px] text-kallo-text leading-snug sm:text-[26px]"
    >
      {name ? t(`${key}Named`, { name }) : t(key)}
    </motion.p>
  );
}
