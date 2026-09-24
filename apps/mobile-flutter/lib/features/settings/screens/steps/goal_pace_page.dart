import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_motion.dart';
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
/// moves the number above, where the eye already is.
///
/// The plan is computed from the body, so until the body is STORED the page
/// is locked: the controls are dimmed and inert (an edit there could not be
/// saved, and leaving for the metrics page would drop it), and the one live
/// action is the way to the metrics — onboarding's unlock card when there is
/// no body at all, a "fill in" button when a stored body has a gap. Either
/// swaps this page for the metrics page rather than stacking a third level.
class GoalPacePage extends StatelessWidget {
  const GoalPacePage({super.key});

  void _fillBody(BuildContext context) => Navigator.of(context).pushReplacement(
    MaterialPageRoute<void>(builder: (_) => const AboutYouPage()),
  );

  @override
  Widget build(BuildContext context) => SettingsStepPage(
    step: SettingsStep.goal,
    title: tr('settings.rows.goalPace'),
    builder: (context, page) {
      final locked = page.session.needsBodyFirst;
      // No body at all: the target card IS the unlock card, and its button
      // must stay live. A legacy gap still draws a (guessed) target, so that
      // card locks too and the way out is spelled out below it.
      final unlockCard = page.session.answers.stepTwoValues == null;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Locked(
            locked: locked && !unlockCard,
            child: StepTarget(
              answers: page.session.answers,
              onChanged: page.session.changed,
              onFillMissing: () => _fillBody(context),
            ),
          ),
          if (locked && !unlockCard) ...[
            const SizedBox(height: KalloSpacing.sp2),
            Text(tr('settings.rows.needsBodyFirst'), style: dashMeta()),
            const SizedBox(height: KalloSpacing.sp3),
            KalloButton(
              title: tr('onboarding.target.fillMissing'),
              variant: KalloButtonVariant.secondary,
              onPressed: () => _fillBody(context),
            ),
          ],
          const SizedBox(height: KalloSpacing.sp3),
          _Locked(
            locked: locked,
            child: StepGoal(
              answers: page.session.answers,
              onChanged: page.session.changed,
            ),
          ),
        ],
      );
    },
  );
}

/// Dimmed and inert while the plan cannot be saved.
class _Locked extends StatelessWidget {
  const _Locked({required this.locked, required this.child});

  final bool locked;
  final Widget child;

  @override
  Widget build(BuildContext context) => IgnorePointer(
    ignoring: locked,
    child: AnimatedOpacity(
      opacity: locked ? 0.4 : 1,
      duration: KalloMotion.quick,
      child: child,
    ),
  );
}
