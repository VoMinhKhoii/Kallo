'use client';

import { Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

interface CustomSelectOption {
  value: string;
  label: string;
  /** Shown before the label, in the list and on the closed field. */
  icon?: ReactNode;
  /** A muted second line, in the list only. */
  description?: string;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
}

export function CustomSelect({ options, value, onChange }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((o) => o.value === value);

  // Open upward when the list would run past the bottom of the scrolling
  // pane (and under a footer such as the save bar) but fits above.
  useLayoutEffect(() => {
    if (!isOpen) {
      setDropUp(false);
      return;
    }
    const field = containerRef.current;
    const menu = menuRef.current;
    if (!field || !menu) return;
    let pane = field.parentElement;
    while (pane && !/(auto|scroll)/.test(getComputedStyle(pane).overflowY)) {
      pane = pane.parentElement;
    }
    const bounds = pane?.getBoundingClientRect() ?? {
      top: 0,
      bottom: window.innerHeight,
    };
    const rect = field.getBoundingClientRect();
    const below = bounds.bottom - rect.bottom;
    const above = rect.top - bounds.top;
    setDropUp(menu.offsetHeight + 8 > below && above > below);
  }, [isOpen]);

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
        className={`flex h-9 w-full items-center justify-between rounded-lg border bg-card px-3 text-[14px] text-kallo-text transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent/40 ${
          isOpen
            ? 'border-kallo-accent shadow-sm ring-1 ring-kallo-accent/20'
            : 'border-kallo-border hover:border-kallo-accent/50'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2 pr-2">
          {selectedOption?.icon}
          <span className="truncate">{selectedOption?.label}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-kallo-text-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: dropUp ? 5 : -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropUp ? 5 : -5, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute right-0 left-0 z-[120] ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} overflow-hidden rounded-xl border border-kallo-border bg-card py-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.08)]`}
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
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[14px] text-kallo-text transition-colors hover:bg-kallo-track focus-visible:bg-kallo-track focus-visible:outline-none"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {opt.icon}
                  <span className="min-w-0">
                    <span
                      className={`block ${value === opt.value ? 'font-medium' : ''}`}
                    >
                      {opt.label}
                    </span>
                    {opt.description && (
                      <span className="block text-[13px] text-kallo-text-muted">
                        {opt.description}
                      </span>
                    )}
                  </span>
                </span>
                {value === opt.value && (
                  <Check className="h-4 w-4 shrink-0 text-kallo-text" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
