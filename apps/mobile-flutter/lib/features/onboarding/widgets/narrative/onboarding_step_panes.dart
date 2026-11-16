import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import '../../../../shared/widgets/panes/narrative_panes.dart';
import '../../../../shared/widgets/brand/wordmark_bar.dart';
import '../../../../shared/widgets/typography/meta_action.dart';
import '../../../../theme/kallo_theme.dart';
import 'onboarding_question.dart';

/// The question stays far from the controls; the keyed answer stays beside them.
/// A one-column window shows [single], the step's own column.
class OnboardingStepPanes extends StatelessWidget {
  const OnboardingStepPanes({
    super.key,
    required this.screen,
    required this.title,
    required this.direction,
    required this.answer,
    required this.single,
    required this.bottomInset,
    this.onBack,
    this.onSkip,
  });
  final int screen;
  final String title;
  final int direction;
  final Widget answer;
  final Widget single;

  /// What the answer keeps clear at the bottom for its button.
  final double bottomInset;
  final VoidCallback? onBack;
  final VoidCallback? onSkip;
  @override
  Widget build(BuildContext context) => NarrativePanes(
    single: single,
    far: SafeArea(
      bottom: false,
      minimum: const EdgeInsets.only(top: 12),
      child: OnboardingQuestion(
        screen: screen,
        title: title,
        direction: direction,
        bottomInset: bottomInset,
        onBack: onBack,
      ),
    ),
    near: SafeArea(
      bottom: false,
      minimum: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 44,
            child: Padding(
              padding: const EdgeInsets.only(right: WordmarkBar.rowInset),
              child: Align(
                alignment: Alignment.centerRight,
                child:
                    onSkip == null
                        ? null
                        : MetaAction(
                          padding: const EdgeInsets.symmetric(
                            horizontal: KalloSpacing.sp3,
                          ),
                          label: tr('common.skip'),
                          onTap: onSkip,
                        ),
              ),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: answer,
            ),
          ),
        ],
      ),
    ),
  );
}
