import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/profile/onboarding.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/onboarding_answers.dart';
import '../logic/onboarding_step_spec.dart';
import '../widgets/target/target_card.dart';

/// Screen 6 — "Your daily target": the one screen that gives something back
/// rather than asking for it, so the whole page is the card. A user who left
/// the metrics blank gets the unlock copy in the same slot.
class StepTarget extends StatelessWidget {
  const StepTarget({
    super.key,
    required this.answers,
    required this.onChanged,
    required this.onFillMissing,
  });

  final OnboardingAnswers answers;
  final VoidCallback onChanged;

  /// Jumps back to the screen that collects whatever the target is missing.
  /// Only reachable from the unlock card — with a number on screen there is
  /// nothing to go back for.
  final VoidCallback onFillMissing;

  @override
  Widget build(BuildContext context) {
    final macros = answers.targets;
    if (macros == null) return _UnlockCard(onFillMissing: onFillMissing);
    // [TargetCard] still speaks the server's strings, so the enum converts on
    // the way in and back — the only place in the wizard that does.
    return TargetCard(
      macros: macros,
      carbSplit: carbSplitToString(answers.carbSplit),
      onCarbSplitChanged: (value) {
        answers.carbSplit = carbSplitFromString(value);
        onChanged();
      },
    );
  }
}

class _UnlockCard extends StatelessWidget {
  const _UnlockCard({required this.onFillMissing});

  final VoidCallback onFillMissing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _card(),
        const SizedBox(height: KalloSpacing.sp3),
        // The way OUT of the dead end. The primary CTA still advances — the
        // plan is savable without a target — so this is the quiet second
        // action, not a gate.
        KalloButton(
          title: tr('onboarding.target.fillMissing'),
          variant: KalloButtonVariant.secondary,
          onPressed: onFillMissing,
        ),
      ],
    );
  }

  Widget _card() {
    return Container(
      padding: const EdgeInsets.all(KalloSpacing.sp4),
      decoration: BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.circular(KalloRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr('onboarding.bodyMetrics.unlockTitle'), style: dashBody()),
          const SizedBox(height: KalloSpacing.sp1),
          Text(tr('onboarding.bodyMetrics.unlockHint'), style: dashMeta()),
        ],
      ),
    );
  }
}

/// Screen 6's contract — the last one, so the CTA reads "Save my plan" and
/// the wizard's chrome cross-fades the label into place.
OnboardingStepSpec stepTargetSpec({
  required OnboardingAnswers answers,
  required VoidCallback onChanged,
  required VoidCallback onFillMissing,
}) => (
      title: tr('onboarding.target.title'),
      body: StepTarget(
        answers: answers,
        onChanged: onChanged,
        onFillMissing: onFillMissing,
      ),
      ctaLabel: tr('onboarding.savePlan'),
      ctaEnabled: true,
    );
