import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/profile/onboarding.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/onboarding_answers.dart';
import '../widgets/target/target_card.dart';

/// Screen 6 — "Your daily target": the one screen that gives something back
/// rather than asking for it, so the whole page is the card. A user who left
/// the metrics blank gets the unlock copy in the same slot.
class StepTarget extends StatelessWidget {
  const StepTarget({
    super.key,
    required this.answers,
    required this.onChanged,
  });

  final OnboardingAnswers answers;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final macros = answers.targets;
    if (macros == null) return const _UnlockCard();
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
  const _UnlockCard();

  @override
  Widget build(BuildContext context) {
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
