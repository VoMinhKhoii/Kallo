import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../shared/widgets/mascot/bun_mascot.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../data/constants.dart';
import 'onboarding_step_header.dart';

/// The shape every onboarding screen wears: header, the bun's guide band, the
/// page title, the screen's own content, and one black CTA pinned to the
/// bottom.
///
/// The CTA OVERLAYS the content rather than sitting beside it in the Column, so
/// a long list (screen 2's A–Z countries) genuinely runs under the button and
/// fades out behind it. A Column would have stopped the list dead above the
/// button, and a list that ends on a hard edge reads as "that is all there is".
class OnboardingStepScaffold extends StatefulWidget {
  const OnboardingStepScaffold({
    super.key,
    required this.screen,
    required this.title,
    required this.child,
    required this.ctaLabel,
    this.onContinue,
    this.busy = false,
    this.onBack,
    this.onSkip,
  });

  /// 1-based wizard screen, out of [kOnboardingScreenCount].
  final int screen;

  final String title;
  final Widget child;
  final String ctaLabel;

  /// Null disables the CTA (screen 3 with an out-of-range metric).
  final VoidCallback? onContinue;
  final bool busy;

  /// Screen 1 pops the wizard instead; every other screen goes back one.
  final VoidCallback? onBack;

  /// Absent on screen 1 — a language has to be chosen.
  final VoidCallback? onSkip;

  /// Button (50) + the gap under it. Content scrolls behind this much.
  static const double ctaReserve = 50 + KalloSpacing.sp3;
  static const double fadeHeight = 40;

  @override
  State<OnboardingStepScaffold> createState() => _OnboardingStepScaffoldState();
}

class _OnboardingStepScaffoldState extends State<OnboardingStepScaffold> {
  final ScrollController _scroll = ScrollController();
  bool _hasMore = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_sync);
    WidgetsBinding.instance.addPostFrameCallback((_) => _sync());
  }

  @override
  void didUpdateWidget(OnboardingStepScaffold old) {
    super.didUpdateWidget(old);
    // The content can grow or shrink in place (screen 4's pace ruler appearing,
    // screen 2's list filtering) without the scroll position moving at all.
    WidgetsBinding.instance.addPostFrameCallback((_) => _sync());
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _sync() {
    if (!mounted || !_scroll.hasClients) return;
    final position = _scroll.position;
    final more = position.maxScrollExtent - position.pixels > 1;
    if (more != _hasMore) setState(() => _hasMore = more);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          OnboardingStepHeader(
            step: widget.screen,
            total: kOnboardingScreenCount,
            progressLabel: tr('onboarding.stepOf', namedArgs: {
              'current': '${widget.screen}',
              'total': '$kOnboardingScreenCount',
            }),
            onBack: widget.onBack,
            onSkip: widget.onSkip,
            skipLabel: widget.onSkip == null ? null : tr('common.skip'),
          ),
          const SizedBox(height: KalloSpacing.sp3),
          BunMascot(speech: tr('onboarding.guide.step${widget.screen}')),
          const SizedBox(height: KalloSpacing.sp3),
          Text(widget.title, style: kPageTitle()),
          const SizedBox(height: KalloSpacing.sp3),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _body() => Stack(
        children: [
          Positioned.fill(
            child: SingleChildScrollView(
              controller: _scroll,
              padding: const EdgeInsets.only(
                bottom: OnboardingStepScaffold.ctaReserve,
              ),
              keyboardDismissBehavior:
                  ScrollViewKeyboardDismissBehavior.onDrag,
              child: widget.child,
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [_fade(), _cta()],
            ),
          ),
        ],
      );

  /// Only drawn while there IS something below — a permanent gradient reads as
  /// a soft edge on a screen that has no more content.
  Widget _fade() => IgnorePointer(
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 150),
          opacity: _hasMore ? 1 : 0,
          child: Container(
            height: OnboardingStepScaffold.fadeHeight,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [KalloColors.surface0, kPage],
              ),
            ),
          ),
        ),
      );

  Widget _cta() => ColoredBox(
        color: kPage,
        child: Padding(
          padding: const EdgeInsets.only(bottom: KalloSpacing.sp3),
          child: KalloButton(
            title: widget.ctaLabel,
            variant: KalloButtonVariant.cta,
            loading: widget.busy,
            disabled: widget.onContinue == null,
            onPressed: widget.onContinue,
          ),
        ),
      );
}
