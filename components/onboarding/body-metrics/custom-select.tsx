'use client';

import { Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function CustomSelect({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: any }[];
  value: any;
  onChange: (v: any) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  // When opening downward we pin the menu's TOP to the trigger's bottom; when
  // opening upward we pin the menu's BOTTOM to the trigger's top so the menu
  // stays glued to the field even when its content is shorter than maxHeight.
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    width: number;
    maxHeight: number;
    anchor: { kind: 'top'; top: number } | { kind: 'bottom'; bottom: number };
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((o) => o.value === value);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 16;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    // Bias toward opening below; flip up only when there is genuinely no
    // room below and meaningfully more above.
    const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow + 40;
    const availableSpace = openUpward ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(160, Math.min(320, availableSpace - 8));
    setMenuPosition({
      left: rect.left,
      width: rect.width,
      maxHeight,
      anchor: openUpward
        ? { kind: 'bottom', bottom: window.innerHeight - rect.top + 6 }
        : { kind: 'top', top: rect.bottom + 6 },
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    // Capture phase so scroll inside the wizard's scrollable content fires.
    document.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      document.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, updateMenuPosition]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!isOpen) updateMenuPosition();
          setIsOpen((open) => !open);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-[14px] text-nham-text transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent/30 ${
          isOpen
            ? 'border-nham-accent shadow-sm ring-1 ring-nham-accent/20'
            : 'border-[#EAE7E0] hover:border-nham-accent/50'
        }`}
      >
        <span className="truncate pr-2">{selectedOption?.label}</span>
        <ChevronDown
          className={`h-4 w-4 text-[#8B8682] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && menuPosition && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -5, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.98 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  left: menuPosition.left,
                  width: menuPosition.width,
                  maxHeight: menuPosition.maxHeight,
                  zIndex: 140,
                  ...(menuPosition.anchor.kind === 'top'
                    ? { top: menuPosition.anchor.top }
                    : { bottom: menuPosition.anchor.bottom }),
                }}
                className="overflow-y-auto rounded-xl border border-[#EAE7E0] bg-white py-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
              >
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[14px] text-nham-text transition-colors hover:bg-nham-track"
                  >
                    <span className={value === opt.value ? 'font-medium' : ''}>
                      {opt.label}
                    </span>
                    {value === opt.value && (
                      <Check className="h-4 w-4 text-nham-accent" />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
