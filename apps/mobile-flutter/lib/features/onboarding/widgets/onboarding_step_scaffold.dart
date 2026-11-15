import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import '../../../shell/window/window_layout.dart';
import '../../../shared/widgets/panes/narrative_panes.dart';
import 'narrative/onboarding_question.dart';
import 'narrative/onboarding_answer.dart';
import '../../../shared/widgets/typography/meta_action.dart';

import '../../../shared/widgets/mascot/bun_mascot.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';
import '../data/constants.dart';
import '../logic/onboarding_step_spec.dart';
import 'backdrop/step_backdrop.dart';
import 'onboarding_step_header.dart';

/// Persistent wizard chrome moves the keyed answer beside its question on
/// wide windows, preserving fields and scroll position through a fold.
class OnboardingStepScaffold extends StatefulWidget {
  const OnboardingStepScaffold({
    super.key,
    required this.screen,
    required this.spec,
    required this.direction,
    this.busy = false,
    this.onContinue,
    this.onBack,
    this.onSkip,
  });

  /// 1-based wizard screen, out of [kOnboardingScreenCount]. It keys the
  /// content region, so each screen gets a fresh scroll offset and fresh field
  /// controllers instead of inheriting the last one's.
  final int screen;

  final OnboardingStepSpec spec;

  /// +1 walking forward, -1 walking Back — the sweep mirrors with it.
  final int direction;

  /// Null disables the CTA (screen 3 with an out-of-range metric).
  final VoidCallback? onContinue;
  final bool busy;

  /// Screen 1 pops the wizard instead; every other screen goes back one.
  final VoidCallback? onBack;

  /// Absent on screen 1 — a language has to be chosen.
  final VoidCallback? onSkip;

  /// Button (50) + the gap under it, ABOVE the bottom inset.
  static const double ctaReserve = 50 + KalloSpacing.sp3;
  static const double fadeHeight = 40;

  @override
  State<OnboardingStepScaffold> createState() => _OnboardingStepScaffoldState();
}

class _OnboardingStepScaffoldState extends State<OnboardingStepScaffold> {
  final _bodyKey = GlobalKey();
  int get screen => widget.screen;
  OnboardingStepSpec get spec => widget.spec;
  int get direction => widget.direction;
  bool get busy => widget.busy;
  VoidCallback? get onContinue => widget.onContinue;
  VoidCallback? get onBack => widget.onBack;
  VoidCallback? get onSkip => widget.onSkip;

  @override
  Widget build(BuildContext context) {
    final inset = MediaQuery.viewPaddingOf(context).bottom;
    final twoPane = WindowLayout.of(context).twoPane;
    return LayoutBuilder(
      builder:
          (context, box) => Stack(
            children: [
              const Positioned.fill(child: StepBackdrop()),
              if (twoPane)
                NarrativePanes(
                  far: SafeArea(
                    bottom: false,
                    minimum: const EdgeInsets.only(top: 12),
                    child: OnboardingQuestion(
                      screen: screen,
                      title: spec.title,
                      direction: direction,
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
                          child: Align(
                            alignment: Alignment.centerRight,
                            child:
                                onSkip == null
                                    ? null
                                    : MetaAction(
                                      label: tr('common.skip'),
                                      onTap: onSkip,
                                    ),
                          ),
                        ),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 24),
                            child: _body(box.biggest, inset),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else
                // Only the chrome is inset, and only at the top: the band below it
                // reaches the screen's bottom edge on purpose.
                SafeArea(
                  bottom: false,
                  minimum: EdgeInsets.only(
                    top: MediaQuery.viewPaddingOf(context).top == 0 ? 12 : 0,
                  ),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 468),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Edge to edge: the header insets its own row so the chevron
                          // glyph lands on the gutter the title below it starts on.
                          OnboardingStepHeader(
                            step: screen,
                            total: kOnboardingScreenCount,
                            progressLabel: tr(
                              'onboarding.stepOf',
                              namedArgs: {
                                'current': '$screen',
                                'total': '$kOnboardingScreenCount',
                              },
                            ),
                            onBack: onBack,
                            onSkip: onSkip,
                            skipLabel:
                                onSkip == null ? null : tr('common.skip'),
                          ),
                          const SizedBox(height: KalloSpacing.sp3),
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: KalloSpacing.sp6,
                              ),
                              child: _guideAndContent(box.biggest, inset),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
    );
  }

  Widget _guideAndContent(Size field, double inset) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      // A longer line grows the bubble; unanimated, that shove lands on the
      // title in one frame. NOT clipped — the bubble's tail and its shadow
      // both live outside its box, and clipping them would change how the
      // band reads at rest, not just mid-morph.
      AnimatedSize(
        duration: KalloMotion.quick,
        curve: KalloEase.standard,
        alignment: Alignment.topCenter,
        clipBehavior: Clip.none,
        child: BunMascot(speech: tr('onboarding.guide.step$screen')),
      ),
      const SizedBox(height: KalloSpacing.sp3),
      Expanded(child: _body(field, inset)),
    ],
  );

  Widget _body(Size field, double inset) => OnboardingAnswer(
    key: _bodyKey,
    field: field,
    inset: inset,
    screen: screen,
    spec: spec,
    direction: direction,
    busy: busy,
    onContinue: onContinue,
    onBack: onBack,
  );
}
