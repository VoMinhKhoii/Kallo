import { Minus, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import type { MealItem } from '@/lib/types/meal';
import { cn } from '@/lib/utils';

interface MealEntryItemProps {
  item: MealItem;
  index: number;
  isEditing: boolean;
  onQuantityChange: (itemId: string, delta: number) => void;
}

export function MealEntryItem({
  item,
  index,
  isEditing,
  onQuantityChange,
}: MealEntryItemProps) {
  const getDelta = (sign: 1 | -1) =>
    (item.unit === 'g' || item.unit === 'ml' ? 10 : 1) * sign;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'flex items-center justify-between py-2.5 text-[13px]',
        isEditing && 'rounded-lg bg-[#FEFBF6]/80 px-2'
      )}
      style={{ fontFamily: 'DM Sans, sans-serif' }}
    >
      {/* Left: edit controls + item name */}
      <div className="flex min-w-0 items-center gap-2">
        {isEditing && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label={`Decrease ${item.name} quantity`}
              disabled={item.quantity <= 0}
              onClick={() => onQuantityChange(item.id, getDelta(-1))}
              className="flex h-5 w-5 items-center justify-center rounded-md border border-[#E8D5B5]/60 bg-white text-[#8B7355] transition-colors hover:bg-[#F0EAE0] disabled:opacity-40"
            >
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span className="w-7 text-center font-semibold text-[#2C2416] text-[11px] tabular-nums">
              {item.quantity}
            </span>
            <button
              type="button"
              aria-label={`Increase ${item.name} quantity`}
              onClick={() => onQuantityChange(item.id, getDelta(1))}
              className="flex h-5 w-5 items-center justify-center rounded-md border border-[#E8D5B5]/60 bg-white text-[#8B7355] transition-colors hover:bg-[#F0EAE0]"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
        <span className="truncate font-medium text-[#2C2416]">{item.name}</span>
      </div>

      {/* Right: P/C/F macros + calories */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex gap-2 text-[#8B7355] text-[10px] tabular-nums">
          <span className="w-6 text-right">
            P:{Math.round(item.macros.protein)}
          </span>
          <span className="w-6 text-right">
            C:{Math.round(item.macros.carbs)}
          </span>
          <span className="w-6 text-right">
            F:{Math.round(item.macros.fat)}
          </span>
        </div>
        <span className="w-12 text-right font-bold text-[#2C2416] tabular-nums">
          {Math.round(item.macros.calories)}
        </span>
      </div>
    </motion.div>
  );
}
