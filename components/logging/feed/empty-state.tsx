import { UtensilsCrossed } from 'lucide-react';
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
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center gap-4 py-10"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.3 }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8D5B5]/30">
          <UtensilsCrossed className="h-5 w-5 text-[#8B7355]" />
        </div>
      </motion.div>

      <div className="space-y-1.5 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="font-normal text-[#2C2416] text-xl tracking-tight"
          style={{ fontFamily: 'Lora, serif' }}
        >
          What are you having?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="text-[#8B7355] text-sm"
          style={{ fontFamily: 'DM Sans, sans-serif' }}
        >
          Describe your meal and get a macro breakdown.
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="flex flex-wrap justify-center gap-1.5"
      >
        {SUGGESTIONS.map((suggestion) => (
          <button
            type="button"
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="rounded-full border border-[#E8D5B5]/60 bg-white/80 px-3 py-1 font-medium text-[#6B5D4F] text-xs transition-colors hover:border-[#C9A87C]/50 hover:bg-[#E8D5B5]/15"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            {suggestion}
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}
