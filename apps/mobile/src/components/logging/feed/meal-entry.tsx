import { Check, Minus, Pencil, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  ZoomIn,
} from 'react-native-reanimated';
import type { MealItem, MealQuantityEdit, ParsedMeal } from '@/lib/types/meal';
import {
  applyQuantityChange,
  deriveQuantityEdits,
  MIN_DISH_GRAMS,
  recalculateTotals,
} from '~/lib/logging/logic/meal-utils';
import { useTranslations } from '~/i18n';
import { fmtG, fmtKcal } from '~/lib/logging/logic/format';
import { Card } from '~/theme/primitives';
import { Text } from '~/theme/text';
import { colors, fonts, fontSize, radii, shadow, space } from '~/theme/tokens';

// Briefly block Confirm after a quantity tap so a fast double-tap on a
// stepper can't slip through and save before the user is done adjusting.
const CONFIRM_DEBOUNCE_MS = 300;

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
  const t = useTranslations('logging.mealEntry');
  const tLogging = useTranslations('logging');
  const original = parsedMeal.items;
  const [items, setItems] = useState<MealItem[]>(original);
  const [editing, setEditing] = useState(false);
  const [confirmCoolingDown, setConfirmCoolingDown] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totals = recalculateTotals(items);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

  const change = (itemId: string, delta: number) => {
    setItems((prev) => applyQuantityChange(prev, original, itemId, delta));
    setConfirmCoolingDown(true);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(
      () => setConfirmCoolingDown(false),
      CONFIRM_DEBOUNCE_MS
    );
  };

  const isBusy = busy === true;
  const confirmDisabled = isBusy || (editing && confirmCoolingDown);

  return (
    // exiting fades the card on confirm instead of a hard pop-out (web smoothly
    // collapses the entry in place).
    <Animated.View
      style={styles.wrap}
      exiting={FadeOut.duration(200).reduceMotion(ReduceMotion.System)}
    >
      <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="mealQuote" style={styles.quote}>
          {rawInput || parsedMeal.mealName}
        </Text>
        <Pressable
          onPress={() => setEditing((e) => !e)}
          hitSlop={8}
          style={[styles.editPill, editing ? styles.editPillDone : styles.editPillEdit]}
        >
          {/* Keyed swap so edit↔done pops with a scale-in (web AnimatePresence). */}
          <Animated.View
            key={editing ? 'done' : 'edit'}
            style={styles.editPillInner}
            entering={ZoomIn.duration(150).reduceMotion(ReduceMotion.System)}
          >
            {editing ? (
              <Check color={colors.accent} size={12} />
            ) : (
              <Pencil color={colors.textMuted} size={12} />
            )}
            <Text
              variant="pillLabel"
              style={editing ? styles.editPillLabelDone : styles.editPillLabelEdit}
            >
              {editing ? t('done') : t('edit')}
            </Text>
          </Animated.View>
        </Pressable>
      </View>

      <View style={styles.detailsBlock}>
        <View style={styles.items}>
          {items.map((item) => {
            const isGrams = item.unit === 'g' || item.unit === 'ml';
            const step = isGrams ? 10 : 1;
            const minusDisabled = item.quantity <= MIN_DISH_GRAMS;
            return (
              // layout animates the padding/bg shift when edit mode toggles.
              <Animated.View
                key={item.id}
                layout={LinearTransition.duration(150).reduceMotion(
                  ReduceMotion.System
                )}
                style={[styles.itemRow, editing ? styles.itemRowEditing : styles.itemRowResting]}
              >
                <View style={styles.itemLeft}>
                  {editing ? (
                    <Animated.View
                      style={styles.stepper}
                      entering={FadeIn.duration(150).reduceMotion(ReduceMotion.System)}
                      exiting={FadeOut.duration(150).reduceMotion(ReduceMotion.System)}
                    >
                      <Pressable
                        style={[styles.step, minusDisabled && styles.stepDisabled]}
                        disabled={minusDisabled}
                        onPress={() => change(item.id, -step)}
                        hitSlop={6}
                      >
                        <Minus color={colors.textMuted} size={10} />
                      </Pressable>
                      <Text variant="numStrong" style={styles.qty}>
                        {item.quantity}
                      </Text>
                      <Pressable
                        style={styles.step}
                        onPress={() => change(item.id, step)}
                        hitSlop={6}
                      >
                        <Plus color={colors.textMuted} size={10} />
                      </Pressable>
                    </Animated.View>
                  ) : null}
                  <Text variant="itemName" style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <View style={styles.itemRight}>
                  <View style={styles.itemMacroGroup}>
                    <Text variant="itemMacro" numberOfLines={1}>{`P:${fmtG(item.macros.protein)}`}</Text>
                    <Text variant="itemMacro" numberOfLines={1}>{`C:${fmtG(item.macros.carbs)}`}</Text>
                    <Text variant="itemMacro" numberOfLines={1}>{`F:${fmtG(item.macros.fat)}`}</Text>
                  </View>
                  <Text variant="itemCalories" numberOfLines={1}>
                    {fmtKcal(item.macros.calories)}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </View>

        <View style={styles.totalRow}>
          <Text variant="itemName" style={styles.totalLabel}>
            {t('total')}
          </Text>
          <View style={styles.totalRight}>
            <Text variant="captionTabular" style={styles.macros}>
              {`P: ${fmtG(totals.protein)}  C: ${fmtG(totals.carbs)}  F: ${fmtG(totals.fat)}`}
            </Text>
            <Text variant="numStrong">{fmtKcal(totals.calories)}</Text>
          </View>
        </View>
      </View>
      </Card>

      {/* Action button — sits outside the card, as on web. */}
      <View style={styles.saveWrap}>
        <Pressable
          onPress={() => onConfirm(deriveQuantityEdits(items, original))}
          disabled={confirmDisabled}
          style={({ pressed }) => [
            styles.saveBtn,
            editing ? styles.saveBtnEditing : styles.saveBtnDefault,
            pressed && !confirmDisabled && styles.saveBtnPressed,
            confirmDisabled && styles.saveBtnDisabled,
          ]}
        >
          <Check color={editing ? colors.btn : '#ffffff'} size={14} />
          <Text style={[styles.saveLabel, editing ? styles.saveLabelEditing : styles.saveLabelDefault]}>
            {tLogging('confirm')}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space[3] },
  card: {
    borderRadius: radii.containerLg,
    borderColor: colors.borderSoft,
    gap: space[2],
    ...shadow.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  quote: { flex: 1, fontSize: 17 },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingVertical: space[1],
    paddingHorizontal: 10,
  },
  editPillInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editPillEdit: { borderColor: colors.borderSoft },
  editPillDone: {
    borderColor: colors.accentSelectedBorder,
    backgroundColor: colors.accentSelectedFill,
  },
  editPillLabelEdit: { color: colors.textMuted },
  editPillLabelDone: { color: colors.accent },
  detailsBlock: {
    marginTop: space[5],
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: colors.border,
    paddingTop: space[4],
  },
  // 4px between rows (web space-y-1), 16px before totals (web mb-4).
  items: { gap: space[1], marginBottom: space[4] },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  itemRowResting: { paddingVertical: 10 },
  itemRowEditing: {
    borderRadius: radii.md,
    backgroundColor: colors.surface80,
    paddingHorizontal: space[2],
    paddingVertical: 10,
  },
  itemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  step: {
    width: 28,
    height: 28,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.elev,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.4 },
  qty: { width: 28, textAlign: 'center', fontFamily: fonts.sansSemiBold, fontSize: fontSize['2xs'] },
  itemName: { flex: 1 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  itemMacroGroup: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: colors.borderHalf,
    paddingTop: space[3],
  },
  totalLabel: { fontFamily: fonts.sansBold },
  totalRight: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  macros: { color: colors.textMuted },
  saveWrap: { marginTop: space[3], flexDirection: 'row' },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.buttonXl,
    paddingHorizontal: space[3],
    paddingVertical: 10,
  },
  saveBtnDefault: { backgroundColor: colors.btn, ...shadow.sm },
  saveBtnEditing: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.btnBorderGhost,
  },
  saveBtnPressed: { opacity: 0.85 },
  saveBtnDisabled: { opacity: 0.5 },
  saveLabel: { fontFamily: fonts.sansMedium, fontSize: fontSize.xs },
  saveLabelDefault: { color: '#ffffff' },
  saveLabelEditing: { color: colors.btn },
});
