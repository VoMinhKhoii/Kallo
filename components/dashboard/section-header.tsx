'use client';

import { motion } from 'motion/react';

interface SectionHeaderProps {
  title: string;
  delay?: number;
}

export function SectionHeader({ title, delay = 0.1 }: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <span className="mb-2 block font-bold text-[#8C857D] text-[12px] uppercase tracking-[0.2em]">
        {title}
      </span>
    </motion.div>
  );
}
