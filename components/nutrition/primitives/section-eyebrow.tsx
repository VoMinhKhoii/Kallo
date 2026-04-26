'use client';

import { motion } from 'motion/react';

interface SectionEyebrowProps {
  label: string;
  /** Optional secondary label (e.g. range word). Rendered after a middle dot. */
  trailing?: string;
  delay?: number;
}

export function SectionEyebrow({
  label,
  trailing,
  delay = 0,
}: SectionEyebrowProps) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="font-bold text-[11px] text-nham-stone uppercase tracking-[0.22em]"
    >
      <span>{label}</span>
      {trailing ? (
        <>
          <span aria-hidden="true" className="mx-2 text-nham-border">
            ·
          </span>
          <span>{trailing}</span>
        </>
      ) : null}
    </motion.p>
  );
}
