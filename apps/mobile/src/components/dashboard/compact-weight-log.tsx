import { Scale } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useTranslations } from '~/i18n';
import { ApiError } from '~/lib/api-client';
import { parseDecimalInput } from '~/lib/dashboard/logic/format';
import { useLogWeight } from '~/lib/dashboard/hooks/use-weight';
import { Text } from '~/theme/text';
import { colors, fonts, fontSize, radii, space } from '~/theme/tokens';

/**
 * CompactWeightLog — mobile port of the web `components/dashboard/current/
 * compact-weight-log.tsx`. A single-line weight logger: decimal/comma-tolerant
 * number input + a kg suffix + a Save/Update submit. Prefills with today's
 * logged weight (falling back to the profile's current weight) and flips to an
 * "Update" affordance once a value exists for today.
 *
 * i18n via `~/i18n` (use-intl) — the SAME `dashboard` keys the web component
 * uses (`weightCard.*`, `saving`, `save`, `units.kg`).
 *
 * Deviations from web, all sanctioned by the porting spec:
 *  - No react-hook-form / zod resolver. Validation is a trivial inline numeric
 *    guard (NaN or out of 30–300 kg). We must NOT import `weightLogSchema` as a
 *    value (it would drag `zod` + web-only deps into the RN bundle). The bound
 *    message comes from the catalog (`weightCard.invalid`).
 *  - No sonner toast host → success/failure feedback is a transient inline line
 *    in the hint/error slot (auto-clears).
 *  - The web's hidden `loggedDate` field becomes a closed-over prop sent in the
 *    mutation body.
 */

interface CompactWeightLogProps {
  currentWeight: number;
  todayWeight: number | null | undefined;
  todayDate: string;
}

const WEIGHT_MIN = 30;
const WEIGHT_MAX = 300;

type Feedback = { kind: 'success' | 'error'; message: string } | null;

export function CompactWeightLog({
  currentWeight,
  todayWeight,
  todayDate,
}: CompactWeightLogProps) {
  const t = useTranslations('dashboard');
  const logWeight = useLogWeight();
  const hasTodayWeight = typeof todayWeight === 'number';
  const prefill = String(todayWeight ?? currentWeight);

  const [value, setValue] = useState(prefill);
  const [dirty, setDirty] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the field synced to incoming props ONLY while the user hasn't typed —
  // once dirty, prop changes must not clobber their input (mirrors the web's
  // `if (!isDirty) reset(...)` effect). Done with React's "adjust state during
  // render" pattern (store the last-seen prefill, reset on change) rather than
  // an effect, which would trigger a second cascading render.
  const [lastPrefill, setLastPrefill] = useState(prefill);
  if (prefill !== lastPrefill) {
    setLastPrefill(prefill);
    if (!dirty) setValue(prefill);
  }

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    []
  );

  const showFeedback = (next: Feedback) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(next);
    if (next) {
      feedbackTimer.current = setTimeout(() => setFeedback(null), 3000);
    }
  };

  const onChangeText = (next: string) => {
    setValue(next);
    setDirty(true);
    if (validationError) setValidationError(null);
    if (feedback) showFeedback(null);
  };

  const onSubmit = async () => {
    const weightKg = parseDecimalInput(value);
    // Trivial inline numeric guard (the web's zod resolver, distilled).
    if (
      Number.isNaN(weightKg) ||
      weightKg < WEIGHT_MIN ||
      weightKg > WEIGHT_MAX
    ) {
      setValidationError(t('weightCard.invalid'));
      showFeedback({ kind: 'error', message: t('weightCard.invalidValue') });
      return;
    }
    setValidationError(null);

    try {
      await logWeight.mutateAsync({ loggedDate: todayDate, weightKg });
      // Match the web: stay populated with the submitted value, clear dirty so
      // the prop-sync (now fed the refetched todayWeight) takes over.
      setValue(String(weightKg));
      setDirty(false);
      showFeedback({ kind: 'success', message: t('weightCard.saved') });
    } catch (error) {
      // The server returns a localized zod message in body.error.message.
      const message =
        error instanceof ApiError ? error.message : t('weightCard.saveFailed');
      console.error('[dashboard] compact weight log failed', error);
      showFeedback({ kind: 'error', message });
    }
  };

  const isPending = logWeight.isPending;
  const submitLabel = isPending
    ? t('saving')
    : hasTodayWeight
      ? t('weightCard.update')
      : t('save');

  // Exactly one Row 3 line shows. Transient feedback wins; then the validation
  // error; then the edit hint (only when editing an existing entry).
  const showEditHint = hasTodayWeight && !validationError && !feedback;

  return (
    <View style={styles.container}>
      <View style={styles.eyebrowRow}>
        <Scale color={colors.accent} size={14} />
        <Text variant="eyebrow" style={styles.eyebrow}>
          {hasTodayWeight ? t('weightCard.todaysWeight') : t('weightCard.logWeight')}
        </Text>
      </View>

      <View style={styles.inputRow}>
        <View style={styles.inputWrapper}>
          <TextInput
            accessibilityLabel={t('weightCard.inputLabel')}
            style={[styles.input, validationError && styles.inputInvalid]}
            value={value}
            onChangeText={onChangeText}
            keyboardType="decimal-pad"
            autoCorrect={false}
            autoCapitalize="none"
            editable={!isPending}
            placeholderTextColor={colors.placeholderMuted40}
          />
          <Text style={styles.unit}>{t('units.kg')}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isPending, busy: isPending }}
          onPress={onSubmit}
          disabled={isPending}
          style={({ pressed }) => [
            styles.submit,
            pressed && !isPending && styles.submitPressed,
            isPending && styles.submitDisabled,
          ]}
        >
          {isPending ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.submitLabel}>{submitLabel}</Text>
          )}
        </Pressable>
      </View>

      {feedback && (
        <Text
          style={[
            styles.row3,
            feedback.kind === 'success' ? styles.success : styles.error,
          ]}
        >
          {feedback.message}
        </Text>
      )}
      {!feedback && validationError && (
        <Text accessibilityRole="alert" style={[styles.row3, styles.error]}>
          {validationError}
        </Text>
      )}
      {showEditHint && (
        <Text style={[styles.row3, styles.hint]}>{t('weightCard.editHint')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Web: rounded-[1.25rem] (20) border nham-border/60 bg nham-surface/70 p-3 (12).
  container: {
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface80,
    borderRadius: radii['3xl'],
    padding: space[3],
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginBottom: 6,
  },
  // Web eyebrow is 9px / 0.15em (= 1.35px @9px); pull the variant size to 9 +
  // matching tracking (the variant's 0.6 under-tracks).
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.35,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  inputWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  // Web: h-9 rounded-xl border-nham-border bg-card pr-8 font-mono text-sm.
  // pr-32px clears the absolutely-pinned "kg" suffix.
  input: {
    height: 36,
    borderRadius: radii.buttonXl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elev,
    paddingLeft: space[3],
    paddingRight: 32,
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.sm,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  inputInvalid: { borderColor: colors.danger },
  // Suffix pinned right-center over the input (web: absolute right-3, centered).
  unit: {
    position: 'absolute',
    right: space[3],
    fontFamily: fonts.sansRegular,
    fontSize: fontSize['2xs'],
    color: colors.stone,
  },
  // Web: h-9 rounded-xl bg-nham-btn px-3 text-white, size xs.
  submit: {
    height: 36,
    borderRadius: radii.buttonXl,
    backgroundColor: colors.btn,
    paddingHorizontal: space[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitPressed: { backgroundColor: colors.btnHover },
  submitDisabled: { opacity: 0.55 },
  submitLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.xs,
    color: '#ffffff',
  },
  // Row 3 — web mt-1 text-[10px]. One line shows at a time.
  row3: {
    marginTop: space[1],
    fontFamily: fonts.sansRegular,
    fontSize: fontSize.eyebrow,
  },
  hint: { color: colors.stone },
  error: { color: colors.danger },
  success: { color: colors.success },
});
