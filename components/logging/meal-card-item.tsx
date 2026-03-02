import { Minus, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import type { MealItem } from '@/lib/types/meal';
import { cn } from '@/lib/utils';

const MACRO_COLORS = {
  calories: 'text-[#2C2416]',
  protein: 'text-blue-600',
  carbs: 'text-amber-600',
  fat: 'text-rose-500',
} as const;

interface MealCardItemProps {
  item: MealItem;
  index: number;
  isEditing: boolean;
  onQuantityChange: (itemId: string, delta: number) => void;
}

export function MealCardItem({
  item,
  index,
  isEditing,
  onQuantityChange,
}: MealCardItemProps) {
  const getDelta = (sign: 1 | -1) =>
    (item.unit === 'g' || item.unit === 'ml' ? 10 : 1) * sign;

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'grid grid-cols-[1fr_4rem_3rem_3rem_3rem] items-center gap-1 py-2.5 text-xs',
        isEditing && 'rounded-lg bg-[#FEFBF6]/80'
      )}
    >
      {/* Item name + quantity controls */}
      <div className="flex items-center gap-2">
        {isEditing && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onQuantityChange(item.id, getDelta(-1))}
              className="flex h-5 w-5 items-center justify-center rounded-md border border-[#E8D5B5]/60 bg-white text-[#8B7355] transition-colors hover:bg-[#F0EAE0]"
            >
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span
              className="w-7 text-center font-semibold text-[#2C2416] text-[11px] tabular-nums"
              style={{
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {item.quantity}
            </span>
            <button
              type="button"
              onClick={() => onQuantityChange(item.id, getDelta(1))}
              className="flex h-5 w-5 items-center justify-center rounded-md border border-[#E8D5B5]/60 bg-white text-[#8B7355] transition-colors hover:bg-[#F0EAE0]"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
        <div className="min-w-0">
          <p
            className="truncate font-medium text-[#2C2416] text-[13px]"
            style={{
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {item.name}
          </p>
          <p
            className="text-[#8B7355] text-[10px]"
            style={{
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {item.quantity} {item.unit}
          </p>
        </div>
      </div>

      {/* Macros */}
      <span
        className={cn(
          'text-right font-semibold tabular-nums',
          MACRO_COLORS.calories
        )}
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {Math.round(item.macros.calories)}
      </span>
      <span
        className={cn(
          'text-right font-medium tabular-nums',
          MACRO_COLORS.protein
        )}
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {Math.round(item.macros.protein)}g
      </span>
      <span
        className={cn(
          'text-right font-medium tabular-nums',
          MACRO_COLORS.carbs
        )}
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {Math.round(item.macros.carbs)}g
      </span>
      <span
        className={cn('text-right font-medium tabular-nums', MACRO_COLORS.fat)}
        style={{ fontFamily: 'DM Sans, sans-serif' }}
      >
        {Math.round(item.macros.fat)}g
      </span>
    </motion.div>
  );
}
