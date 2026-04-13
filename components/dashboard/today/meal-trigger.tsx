'use client';

import { ArrowUp, UtensilsCrossed, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export function MealTrigger() {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const handleOpen = () => {
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const handleClose = useCallback(() => {
    setExpanded(false);
    setText('');
    setTimeout(() => triggerRef.current?.focus(), 60);
  }, []);

  const handleSend = () => {
    if (!text.trim()) return;
    router.push(`/logging?meal=${encodeURIComponent(text.trim())}`);
  };

  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [expanded, handleClose]);

  return (
    <>
      {/* Blur backdrop */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-nham-surface/50 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Floating input — expands above FAB when open */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="fixed right-6 bottom-20 z-50 flex w-[340px] items-center gap-2 rounded-2xl border border-nham-accent/30 bg-card px-4 py-3 shadow-[0_12px_40px_-8px_rgba(44,36,22,0.2)] ring-2 ring-nham-accent/10"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Describe your meal…"
              className="min-w-0 flex-1 bg-transparent text-nham-text text-sm outline-none placeholder:text-nham-stone"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              aria-label="Send meal"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all ${
                text.length > 0
                  ? 'bg-nham-btn text-white shadow-sm hover:bg-nham-btn-hover'
                  : 'bg-nham-track text-nham-stone'
              }`}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating action button */}
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={expanded ? handleClose : handleOpen}
        aria-label={expanded ? 'Close meal input' : 'Log meal'}
        animate={{ rotate: expanded ? 45 : 0 }}
        transition={{ duration: 0.2 }}
        className="fixed right-6 bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-nham-btn text-white shadow-[0_4px_16px_rgba(44,36,22,0.2)] transition-colors hover:bg-nham-btn-hover"
      >
        {expanded ? (
          <X className="h-5 w-5" />
        ) : (
          <UtensilsCrossed className="h-5 w-5" />
        )}
      </motion.button>
    </>
  );
}
