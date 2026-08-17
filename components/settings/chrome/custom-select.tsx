'use client';

import { Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
}

export function CustomSelect({ options, value, onChange }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative min-w-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-[14px] text-kallo-text transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40 ${
          isOpen
            ? 'border-kallo-accent shadow-sm ring-1 ring-kallo-accent/20'
            : 'border-kallo-border hover:border-kallo-accent/50'
        }`}
      >
        <span className="min-w-0 truncate pr-2">{selectedOption?.label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-kallo-text-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full right-0 left-0 z-[120] mt-1.5 overflow-hidden rounded-xl border border-kallo-border bg-white py-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-current={value === opt.value ? 'true' : undefined}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[14px] text-kallo-text transition-colors hover:bg-kallo-track focus-visible:bg-kallo-track focus-visible:outline-none"
              >
                <span className={value === opt.value ? 'font-medium' : ''}>
                  {opt.label}
                </span>
                {value === opt.value && (
                  <Check className="h-4 w-4 text-kallo-text" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
