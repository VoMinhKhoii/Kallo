import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../../dashboard/logic/dashboard_format.dart' show formatCount;
import '../data/logging_models.dart';
import '../data/logging_providers.dart';
import '../logic/format.dart';
import '../logic/meal_utils.dart' show isLikelyPartialDay;

/// A once-daily nudge shown above today's feed when *yesterday* looks
/// under-logged: it opens yesterday so the user can fold in whatever they
/// missed. Ported from the web `partial-yesterday-prompt.tsx`.
///
/// Renders nothing when yesterday has no meals, has any meal with unknown
/// calories (the calorie-based check can't be trusted), or is above the
/// partial-day floor. Dismissal is session-scoped (see
/// [yesterdayPromptDismissedProvider]).
class PartialYesterdayPrompt extends ConsumerWidget {
  const PartialYesterdayPrompt({
    super.key,
    required this.userId,
    required this.yesterday,
    required this.calorieTarget,
    required this.onOpenDay,
  });

  final String userId;
  final String yesterday;
  final int calorieTarget;
  final ValueChanged<String> onOpenDay;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dayAsync =
        ref.watch(loggingDayProvider(LoggingDayArgs(userId, yesterday)));
    final meals = dayAsync.valueOrNull?.persistedMeals ?? const <PersistedMeal>[];

    final hasMeals = meals.isNotEmpty;
    // A meal with unknown calories makes the day's total untrustworthy, so the
    // partial-day check would be misleading — suppress the prompt then.
    final hasUnknownCalories =
        meals.any((m) => m.nutrition.caloriesKcal == null);
    final calories = round0(
      meals.fold<double>(0, (s, m) => s + (m.nutrition.caloriesKcal ?? 0)),
    );

    if (!hasMeals ||
        hasUnknownCalories ||
        !isLikelyPartialDay(calories.toDouble(), calorieTarget)) {
      return const SizedBox.shrink();
    }

    final locale = context.locale.toString();
    final t = 'logging.feedArea.partialYesterdayPrompt';

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        NhamSpacing.sp3,
        NhamSpacing.sp3,
        NhamSpacing.sp3,
        0,
      ),
      child: Container(
        padding: const EdgeInsets.all(NhamSpacing.sp3),
        decoration: BoxDecoration(
          color: NhamColors.surface,
          borderRadius: BorderRadius.circular(NhamRadii.containerLg),
          border: Border.all(color: NhamColors.borderSoft),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  NhamText(
                    '$t.title'.tr(),
                    variant: NhamTextVariant.italicAccent,
                    style: const TextStyle(color: NhamColors.danger),
                  ),
                  const SizedBox(height: 4), // mt-1
                  NhamText(
                    '$t.body'.tr(namedArgs: {
                      'calories': formatCount(calories, locale),
                      'target': formatCount(calorieTarget, locale),
                    }),
                    variant: NhamTextVariant.small,
                    style: const TextStyle(color: NhamColors.textMuted),
                  ),
                  const SizedBox(height: NhamSpacing.sp3), // mt-3
                  _OpenButton(
                    label: '$t.open'.tr(),
                    onTap: () => onOpenDay(yesterday),
                  ),
                ],
              ),
            ),
            const SizedBox(width: NhamSpacing.sp3),
            _DismissButton(
              label: '$t.dismiss'.tr(),
              onTap: () => ref
                  .read(yesterdayPromptDismissedProvider(yesterday).notifier)
                  .state = true,
            ),
          ],
        ),
      ),
    );
  }
}

/// "Open yesterday" — a ghost pill (ArrowLeft + label) whose border lightens to
/// accent/50 on press, mirroring the web's hover treatment.
class _OpenButton extends StatefulWidget {
  const _OpenButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  State<_OpenButton> createState() => _OpenButtonState();
}

class _OpenButtonState extends State<_OpenButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      child: GestureDetector(
        onTap: widget.onTap,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          constraints: const BoxConstraints(minHeight: 32), // min-h-8
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp3,
            vertical: 6, // py-1.5
          ),
          decoration: BoxDecoration(
            color: _pressed ? NhamColors.hover : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.pill),
            border: Border.all(
              color: _pressed ? NhamColors.accent50 : NhamColors.borderSoft,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(LucideIcons.arrowLeft, size: 16, color: NhamColors.text),
              const SizedBox(width: 8), // gap-2
              NhamText(
                widget.label,
                variant: NhamTextVariant.body,
                style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.sm)
                    .copyWith(color: NhamColors.text),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The dismiss affordance — a 32×32 X target whose fill tints to hover on press.
class _DismissButton extends StatefulWidget {
  const _DismissButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  State<_DismissButton> createState() => _DismissButtonState();
}

class _DismissButtonState extends State<_DismissButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      child: GestureDetector(
        onTap: widget.onTap,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          width: 32,
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _pressed ? NhamColors.hover : Colors.transparent,
            shape: BoxShape.circle,
          ),
          child: Icon(
            LucideIcons.x,
            size: 16,
            color: _pressed ? NhamColors.text : NhamColors.textMuted,
          ),
        ),
      ),
    );
  }
}
