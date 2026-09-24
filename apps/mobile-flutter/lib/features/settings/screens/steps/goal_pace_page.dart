import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/kallo_theme.dart';
import '../../../onboarding/screens/step_goal.dart';
import '../../../onboarding/screens/step_target.dart';
import '../../logic/step_session.dart';
import '../../widgets/chrome/settings_step_page.dart';
import 'about_you_page.dart';

/// "Mục tiêu & tốc độ" — the daily target card (onboarding screen 6, carb
/// split inside it) FIRST, then the goal and pace that move it (screen 4).
///
/// Target first because it is what people come to check; every tap below
/// moves the number above, where the eye already is. With no body metrics
/// the card is onboarding's unlock card, and its button swaps this page for
/// the metrics page rather than stacking a third level.
class GoalPacePage extends StatelessWidget {
  const GoalPacePage({super.key});

  @override
  Widget build(BuildContext context) => SettingsStepPage(
    step: SettingsStep.goal,
    title: tr('settings.rows.goalPace'),
    builder:
        (context, page) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            StepTarget(
              answers: page.session.answers,
              onChanged: page.session.changed,
              onFillMissing:
                  () => Navigator.of(context).pushReplacement(
                    MaterialPageRoute<void>(
                      builder: (_) => const AboutYouPage(),
                    ),
                  ),
            ),
            const SizedBox(height: KalloSpacing.sp3),
            StepGoal(
              answers: page.session.answers,
              onChanged: page.session.changed,
            ),
          ],
        ),
  );
}
