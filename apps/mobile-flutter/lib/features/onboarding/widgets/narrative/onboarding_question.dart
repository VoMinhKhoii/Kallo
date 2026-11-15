import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import '../../../../shared/widgets/mascot/bun_mascot.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../shell/window/window_layout.dart';
import '../../data/constants.dart';
import '../onboarding_step_header.dart';

/// The question stays visible while its answer scrolls beside it.
class OnboardingQuestion extends StatelessWidget {
  const OnboardingQuestion({
    super.key,
    required this.screen,
    required this.title,
    required this.direction,
    this.onBack,
  });
  final int screen;
  final String title;
  final int direction;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      OnboardingStepHeader(
        step: screen,
        total: kOnboardingScreenCount,
        gutter: 12,
        progressPadding:
            WindowLayout.of(context).nearLeft
                ? const EdgeInsets.only(right: 12)
                : const EdgeInsets.only(left: 12),
        progressLabel: tr(
          'onboarding.stepOf',
          namedArgs: {'current': '$screen', 'total': '$kOnboardingScreenCount'},
        ),
        onBack: onBack,
      ),
      Expanded(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              BunMascot(speech: tr('onboarding.guide.step$screen')),
              const SizedBox(height: 12),
              AnimatedSwitcher(
                duration:
                    MediaQuery.disableAnimationsOf(context)
                        ? Duration.zero
                        : KalloMotion.page,
                transitionBuilder:
                    (child, animation) => FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: animation.drive(
                          Tween(
                            begin: Offset(direction * .22, 0),
                            end: Offset.zero,
                          ),
                        ),
                        child: child,
                      ),
                    ),
                child: Align(
                  key: ValueKey(screen),
                  alignment: Alignment.centerLeft,
                  child: Text(title, style: kPageTitle()),
                ),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}
