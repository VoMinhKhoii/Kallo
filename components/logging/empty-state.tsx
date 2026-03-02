import { Sparkles, UtensilsCrossed } from 'lucide-react';
import { motion } from 'motion/react';

interface EmptyStateProps {
  onSuggestionClick: (suggestion: string) => void;
}

const SUGGESTIONS = ['2 mực kho + cơm', 'Phở bò tái', 'Bún chả Hà Nội'];

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <motion.div
      key="empty-state"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="flex flex-1 flex-col items-center justify-center gap-6"
    >
      {/* Decorative icon cluster */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: 0.1,
          type: 'spring',
          stiffness: 200,
        }}
        className="relative"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E8D5B5]/40 to-[#C9A87C]/20 shadow-inner">
          <UtensilsCrossed className="h-7 w-7 text-[#8B7355]" />
        </div>
        <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2C2416] shadow-sm">
          <Sparkles className="h-2.5 w-2.5 text-[#C9A87C]" />
        </div>
      </motion.div>

      <div className="space-y-3 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="font-normal text-[#2C2416] text-[2.5rem] leading-tight tracking-tight"
          style={{ fontFamily: 'Lora, serif' }}
        >
          What are you having today?
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mx-auto max-w-sm text-[#8B7355] text-[15px] leading-relaxed"
          style={{
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          Describe your meal naturally — Vietnamese or English — and I&apos;ll
          break down the macros for you.
        </motion.p>
      </div>

      {/* Suggestion chips */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="flex flex-wrap justify-center gap-2"
      >
        {SUGGESTIONS.map((suggestion) => (
          <button
            type="button"
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="rounded-full border border-[#E8D5B5]/60 bg-white/80 px-4 py-1.5 font-medium text-[#6B5D4F] text-xs shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C9A87C]/40 hover:shadow-md"
            style={{
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {suggestion}
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}
