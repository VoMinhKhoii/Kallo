import { Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { MealItem, MealQuantityEdit, ParsedMeal } from '@/lib/types/meal';
import {
  applyQuantityChange,
  deriveQuantityEdits,
  MIN_DISH_GRAMS,
  recalculateTotals,
} from '~/lib/logging/meal-utils';
import { fmtG, fmtKcal } from '~/lib/logging/format';
import { Button, Card } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, fonts, radii, space } from '~/theme/tokens';

/** An unconfirmed analysis: editable dish quantities (+/- steppers) + confirm.
 * Reuses the web's pure quantity helpers so scaling math is identical. */
export function MealEntry({
  parsedMeal,
  rawInput,
  busy,
  onConfirm,
}: {
  parsedMeal: ParsedMeal;
  rawInput: string;
  busy?: boolean;
  onConfirm: (edits: MealQuantityEdit[]) => void;
}) {
  const original = parsedMeal.items;
  const [items, setItems] = useState<MealItem[]>(original);
  const [editing, setEditing] = useState(false);
  const totals = recalculateTotals(items);

  const change = (itemId: string, delta: number) =>
    setItems((prev) => applyQuantityChange(prev, original, itemId, delta));

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="mealQuote" style={styles.quote}>
          {rawInput || parsedMeal.mealName}
        </Text>
        <Pressable onPress={() => setEditing((e) => !e)} hitSlop={8}>
          <Text style={styles.editToggle}>{editing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </View>

      <View style={styles.items}>
        {items.map((item) => {
          const isGrams = item.unit === 'g' || item.unit === 'ml';
          const step = isGrams ? 10 : 1;
          const minusDisabled = isGrams && item.quantity <= MIN_DISH_GRAMS;
          return (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                {editing ? (
                  <View style={styles.stepper}>
                    <Pressable
                      style={[styles.step, minusDisabled && styles.stepDisabled]}
                      disabled={minusDisabled}
                      onPress={() => change(item.id, -step)}
                      hitSlop={6}
                    >
                      <Minus color={colors.text} size={14} />
                    </Pressable>
                    <Text variant="numInline" style={styles.qty}>
                      {item.quantity}
                    </Text>
                    <Pressable
                      style={styles.step}
                      onPress={() => change(item.id, step)}
                      hitSlop={6}
                    >
                      <Plus color={colors.text} size={14} />
                    </Pressable>
                  </View>
                ) : null}
                <Text variant="small" style={styles.itemName} numberOfLines={1}>
                  {item.name}
                  {!editing ? ` · ${item.quantity}${item.unit}` : ''}
                </Text>
              </View>
              <Text variant="meta">{fmtKcal(item.macros.calories)}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.totalRow}>
        <Text variant="small" style={styles.macros}>
          {`P: ${fmtG(totals.protein)}  C: ${fmtG(totals.carbs)}  F: ${fmtG(totals.fat)}`}
        </Text>
        <Text variant="numInline">{fmtKcal(totals.calories)}</Text>
      </View>

      <Button
        title="Save meal"
        onPress={() => onConfirm(deriveQuantityEdits(items, original))}
        loading={busy}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space[3], gap: space[2] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  quote: { flex: 1 },
  editToggle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.accent },
  items: { gap: space[2] },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  itemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  step: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.4 },
  qty: { fontSize: 12, minWidth: 30, textAlign: 'center' },
  itemName: { color: colors.text, flex: 1 },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space[2],
  },
  macros: { color: colors.textMuted },
});
