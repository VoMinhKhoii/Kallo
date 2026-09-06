import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/logic/display_format.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../../../shell/nav/nav_actions.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';
import '../providers/first_run_finish.dart';

/// The celebratory finish shown after the wizard completes, before the paywall
/// and the logging feed.
///
/// The WORK — flushing the signed-out draft onto the server, warming the caches
/// the dashboard and logging screens read their targets from, and picking where
/// the first run ends — belongs to [FirstRunFinishController]; this screen owns
/// the two things that are about what is on screen. It pays the wizard off by
/// counting the freshly-computed daily calorie target up in Lora 40, and it
/// holds a minimum window so the interstitial never flashes.
///
/// A failed flush STOPS here with a retry rather than continuing: the draft is
/// kept (see [OnboardingDraftNotifier.flush]), and walking on would drop the
/// user into an app that has none of their answers.
class WelcomeSetupScreen extends ConsumerStatefulWidget {
  const WelcomeSetupScreen({super.key});

  @override
  ConsumerState<WelcomeSetupScreen> createState() => _WelcomeSetupScreenState();
}

class _WelcomeSetupScreenState extends ConsumerState<WelcomeSetupScreen>
    with SingleTickerProviderStateMixin {
  /// The shortest the interstitial may be on screen, so it never flashes.
  static const Duration minimumWindow = Duration(milliseconds: 1600);

  // Built in initState, not lazily: with no target the field would first be
  // touched by `dispose`, and `createTicker` on a deactivated element throws.
  late final AnimationController _count;

  int? _target;

  /// The draft is still on disk because a post failed — the screen holds on a
  /// retry instead of continuing into an app that has none of the answers.
  bool _flushFailed = false;

  @override
  void initState() {
    super.initState();
    _count = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _run());
  }

  @override
  void dispose() {
    _count.dispose();
    super.dispose();
  }

  Future<void> _run() async {
    if (_flushFailed) setState(() => _flushFailed = false);
    // Started BEFORE the work so the window and the work overlap — it is a
    // floor on the finish, not a delay added to it.
    final window = Future<void>.delayed(minimumWindow);

    final ({int? target, String next}) finished;
    try {
      finished = await ref.read(firstRunFinishProvider).finish();
    } catch (_) {
      if (!mounted) return;
      setState(() => _flushFailed = true);
      showTopToast(
        context,
        tr('onboarding.saveError'),
        variant: TopToastVariant.error,
      );
      return;
    }
    if (!mounted) return;

    final target = finished.target;
    if (target != null) {
      setState(() => _target = target);
      final reduced = WidgetsBinding
          .instance
          .platformDispatcher
          .accessibilityFeatures
          .disableAnimations;
      if (reduced) {
        _count.value = 1;
      } else {
        _count.forward();
      }
    }

    await window;
    if (!mounted) return;
    // `/logging` is a push over the shell, not a `go` — see [openLogging].
    if (finished.next == '/logging') {
      goToLogging(context);
    } else {
      context.go(finished.next);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KalloColors.cream,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_target != null) ...[
                  Text(
                    tr('onboarding.setup.targetReadyLabel').toUpperCase(),
                    textAlign: TextAlign.center,
                    style: dashEyebrow(),
                  ),
                  const SizedBox(height: 10),
                  // The target counts up in Lora 40.
                  AnimatedBuilder(
                    animation: _count,
                    builder: (context, _) {
                      final shown = (_target! * _count.value).round();
                      return Text.rich(
                        TextSpan(
                          children: [
                            // Locale-aware grouping (en "2,000" / vi "2.000").
                            TextSpan(
                              text: formatCount(
                                shown,
                                context.locale.toString(),
                              ),
                            ),
                            TextSpan(
                              text: ' ${tr('onboarding.setup.perDay')}',
                              style: dashMeta(),
                            ),
                          ],
                        ),
                        textAlign: TextAlign.center,
                        style: KalloTextStyles.serifRegular(
                          fontSize: KalloFontSize.h1,
                        ).copyWith(color: KalloColors.text),
                      );
                    },
                  ),
                  const SizedBox(height: 24),
                ],
                Text(
                  tr('onboarding.setup.title'),
                  textAlign: TextAlign.center,
                  style: KalloTextStyles.serifRegular(fontSize: KalloFontSize.h3)
                      .copyWith(color: KalloColors.text),
                ),
                const SizedBox(height: 8),
                Text(
                  tr('onboarding.setup.subtitle'),
                  textAlign: TextAlign.center,
                  style: dashBody(color: kInkMuted),
                ),
                if (_flushFailed) ...[
                  const SizedBox(height: KalloSpacing.sp6),
                  KalloButton(
                    title: tr('common.retry'),
                    variant: KalloButtonVariant.cta,
                    onPressed: _run,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
