import { Check, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface MealEntryActionsProps {
  isEditing: boolean;
  onCancel: () => void;
  onSave: () => void;
  onConfirm: () => void;
}

export function MealEntryActions({
  isEditing,
  onCancel,
  onSave,
  onConfirm,
}: MealEntryActionsProps) {
  return (
    <div className="mt-3 flex">
      {/* Cancel — slides in from the left */}
      <motion.div
        className="shrink-0 overflow-hidden"
        animate={{ width: isEditing ? '50%' : '0%' }}
        transition={{
          duration: 0.25,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        <div className="h-full pr-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-full w-full items-center justify-center gap-1.5 rounded-xl border border-nham-border/70 bg-white px-3 py-2.5 font-medium text-nham-text-muted text-xs shadow-sm transition-all duration-200 hover:border-nham-accent/50 hover:bg-nham-hover/60"
            style={{ fontFamily: 'DM Sans, sans-serif' }}
          >
            <X className="h-3.5 w-3.5 shrink-0" />
            Cancel
          </button>
        </div>
      </motion.div>

      {/* Confirm / Save */}
      <button
        type="button"
        onClick={isEditing ? onSave : onConfirm}
        className="relative flex flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-nham-btn px-3 py-2.5 font-medium text-white text-xs shadow-sm transition-all duration-200 hover:bg-nham-btn-hover hover:shadow-md"
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isEditing ? (
            <motion.span
              key="save"
              className="flex items-center gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Check className="h-3.5 w-3.5 shrink-0" />
              Save Changes
            </motion.span>
          ) : (
            <motion.span
              key="confirm"
              className="flex items-center gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Check className="h-3.5 w-3.5 shrink-0" />
              Confirm &amp; Log Meal
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
