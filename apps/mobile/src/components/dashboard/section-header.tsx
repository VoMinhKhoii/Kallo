import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '~/theme/text';
import { colors, fontSize, fonts, radii, shadow, space } from '~/theme/tokens';

/**
 * SectionHeader — the dashboard section label, ported 1:1 from the web
 * `components/dashboard/section-header.tsx`.
 *
 * Web treatment (both variants share it): a 12px bold uppercase stone label
 * with 0.2em tracking. The mobile `eyebrow` Text variant is identical EXCEPT
 * it is 10px; here the web label is 12px, so we override fontSize/letterSpacing
 * (0.2em @ 12px ≈ 2.4pt) on top of the eyebrow style.
 *
 * - Section 1 (TODAY SUMMARY): a plain stacked title, e.g. the week title.
 * - Sections 2 & 3 (PROGRESS / CONSISTENCY): an inline row with the label on
 *   the left and a READ-ONLY range badge on the right ("30 days"). The badge is
 *   NOT an interactive selector on web (the range is derived from container
 *   width); it stays a passive label here. An optional `action` slot is exposed
 *   for the rare case a section needs a trailing control, but it is unused by
 *   the three core sections.
 */
interface SectionHeaderProps {
  title: string;
  /** Read-only range badge shown at the trailing edge (e.g. "30 days"). */
  range?: string;
  /** Optional trailing slot (overrides `range` when provided). */
  action?: ReactNode;
}

export function SectionHeader({ title, range, action }: SectionHeaderProps) {
  const trailing = action ?? (range ? <Text style={s.rangeBadge}>{range}</Text> : null);

  if (!trailing) {
    return <Text style={[s.label, s.labelStacked]}>{title}</Text>;
  }

  return (
    <View style={s.row}>
      <Text style={s.label}>{title}</Text>
      {trailing}
    </View>
  );
}

/**
 * SectionState — the shared loading / error / empty card, ported from the web
 * `components/dashboard/dashboard-section-state.tsx` (DashboardSectionState).
 *
 * Centered white card with a hairline border and a stone message. When an
 * action is supplied it renders a warm-umber pill button (e.g. "Try again").
 */
interface SectionStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionState({ message, actionLabel, onAction }: SectionStateProps) {
  return (
    <View style={s.stateCard}>
      <Text variant="small" style={s.stateMessage}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [s.stateButton, pressed && s.stateButtonPressed]}
        >
          <Text style={s.stateButtonLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  // 12px bold uppercase stone, tracking 0.2em@12px ≈ 2.4 (vs the 10px eyebrow
  // variant's tracking.eyebrow=2). Web `font-bold text-[12px] text-nham-stone
  // uppercase tracking-[0.2em]`.
  label: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.xs,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.stone,
  },
  // Section 1's stacked title carries the web `mb-2` (8px) below it.
  labelStacked: {
    marginBottom: space[2],
  },
  // Inline header row (Sections 2 & 3): space-between, baseline-ish alignment.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[2],
  },
  // Read-only range badge: `font-medium text-[11px] text-nham-stone` — NOT
  // uppercase, NOT tracked.
  rangeBadge: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize['2xs'],
    color: colors.stone,
  },
  // DashboardSectionState card: centered, minHeight 180, radius 24, 1px border,
  // white bg, padding 16, gap 12, warm low-contrast shadow.
  stateCard: {
    minHeight: 180,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.elev,
    padding: space[4],
    ...shadow.sm,
  },
  stateMessage: {
    textAlign: 'center',
    color: colors.stone,
  },
  // Pill action: `rounded-full bg-nham-btn px-4 py-2 font-semibold text-white text-xs`.
  stateButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.btn,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  stateButtonPressed: {
    opacity: 0.85,
  },
  stateButtonLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.xs,
    color: '#ffffff',
  },
});
