import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../shared/logic/display_format.dart' show formatCount;
import '../../data/logging_models.dart';
import '../../data/logging_providers.dart';
import '../../logic/format.dart';
import '../../logic/meal_utils.dart' show isLikelyPartialDay;

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
    final dismissed = ref.watch(yesterdayPromptDismissedProvider(yesterday));
    final dayAsync = ref.watch(
      loggingDayProvider(LoggingDayArgs(userId, yesterday)),
    );
    final meals =
        dayAsync.valueOrNull?.persistedMeals ?? const <PersistedMeal>[];

    final hasMeals = meals.isNotEmpty;
    // A meal with unknown calories makes the day's total untrustworthy, so the
    // partial-day check would be misleading — suppress the prompt then.
    final hasUnknownCalories = meals.any(
      (m) => m.nutrition.caloriesKcal == null,
    );
    final calories = round0(
      meals.fold<double>(0, (s, m) => s + (m.nutrition.caloriesKcal ?? 0)),
    );

    if (dismissed ||
        !hasMeals ||
        hasUnknownCalories ||
        !isLikelyPartialDay(calories.toDouble(), calorieTarget)) {
      return const SizedBox.shrink();
    }

    final locale = context.locale.toString();
    final t = 'logging.feedArea.partialYesterdayPrompt';

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        KalloSpacing.sp3,
        KalloSpacing.sp3,
        KalloSpacing.sp3,
        0,
      ),
      child: Container(
        padding: const EdgeInsets.all(KalloSpacing.sp3),
        decoration: BoxDecoration(
          color: KalloColors.elev,
          borderRadius: BorderRadius.circular(KalloRadii.containerLg),
          border: Border.all(color: KalloColors.borderSoft),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$t.title'.tr(),
                    style: dashBody().merge(const TextStyle(color: KalloColors.danger)),
                  ),
                  const SizedBox(height: 4), // mt-1
                  Text(
                    '$t.body'.tr(
                      namedArgs: {
                        'calories': formatCount(calories, locale),
                        'target': formatCount(calorieTarget, locale),
                      },
                    ),
                    style: dashMeta(),
                  ),
                  const SizedBox(height: KalloSpacing.sp3), // mt-3
                  _OpenButton(
                    label: '$t.open'.tr(),
                    onTap: () => onOpenDay(yesterday),
                  ),
                ],
              ),
            ),
            const SizedBox(width: KalloSpacing.sp3),
            _DismissButton(
              label: '$t.dismiss'.tr(),
              onTap:
                  () =>
                      ref
                          .read(
                            yesterdayPromptDismissedProvider(
                              yesterday,
                            ).notifier,
                          )
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
            horizontal: KalloSpacing.sp3,
            vertical: 6, // py-1.5
          ),
          decoration: BoxDecoration(
            color: _pressed ? KalloColors.hover : Colors.transparent,
            borderRadius: BorderRadius.circular(KalloRadii.pill),
            border: Border.all(
              color: _pressed ? KalloColors.accent50 : KalloColors.borderSoft,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                LucideIcons.arrowLeft300,
                size: 16,
                color: KalloColors.text,
              ),
              const SizedBox(width: 8), // gap-2
              Text(
                widget.label,
                style: dashBody(),
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
            color: _pressed ? KalloColors.hover : Colors.transparent,
            shape: BoxShape.circle,
          ),
          child: Icon(
            LucideIcons.x300,
            size: 16,
            color: _pressed ? KalloColors.text : KalloColors.textMuted,
          ),
        ),
      ),
    );
  }
}
