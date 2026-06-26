'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface TabButtonProps {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}

export function TabButton({ active, children, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative z-10 flex-1 py-2.5 font-medium text-sm tracking-tight transition-colors duration-200',
        active ? 'text-[#2C2416]' : 'text-[#8B7355]/70',
        'font-sans-display'
      )}
    >
      {children}
      {active && (
        <motion.div
          layoutId="auth-tab-indicator"
          className="absolute inset-0 -z-10 rounded-lg bg-white shadow-sm"
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 30,
          }}
        />
      )}
    </button>
  );
}
