import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/onboarding.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../data/constants.dart';
import '../data/profile_row.dart';
import '../logic/step_one_defaults.dart';
import '../providers/onboarding_providers.dart';
import '../screens/screen_body_metrics.dart';
import '../../../shared/widgets/top_toast.dart';
import '../screens/screen_cooking.dart';
import '../screens/screen_origin.dart';
import 'step_indicator.dart';

const int _totalSteps = kOnboardingTotalSteps;

double? _parseAggression(String? raw, double fallback) {
  if (raw == null || raw.isEmpty) return fallback;
  final n = double.tryParse(raw);
  return n ?? fallback;
}

/// The onboarding wizard body — presentation-agnostic.
///
/// Ported from `components/onboarding/wizard/wizard-modal.tsx`: a step indicator
/// + (optional) close in the header, a scrollable per-step body, and a
/// back / skip / next footer. It owns ALL wizard state (current step, collected
/// screen data, pending, slide direction) but imposes no surface chrome — the
/// caller wraps it. [onComplete] fires when the last step is saved/skipped;
/// [onClose] (nullable — when null the close button is hidden) fires on the X.
///
/// The modal entrance animation (scale/opacity/y) is intentionally NOT here: it
/// belongs to the dialog presentation ([showOnboardingDialog]), not the wizard.
///
/// Icons are Lucide one-for-one: `X`→[LucideIcons.x],
/// `ArrowLeft`→[LucideIcons.arrowLeft], `ArrowRight`→[LucideIcons.arrowRight],
/// `SkipForward`→[LucideIcons.skipForward].
class OnboardingWizard extends ConsumerStatefulWidget {
  const OnboardingWizard({
    super.key,
    required this.onComplete,
    required this.onClose,
  });

  /// Fired once the final step is saved (or skipped). The caller decides where
  /// to go next (the full page and the dialog route to `/welcome`).
  final VoidCallback onComplete;

  /// Fired on the header X. Null hides the close button (mandatory mode).
  final VoidCallback? onClose;

  @override
  ConsumerState<OnboardingWizard> createState() => _OnboardingWizardState();
}

class _OnboardingWizardState extends ConsumerState<OnboardingWizard> {
  int? _currentStep;
  bool _isPending = false;
  // Which control triggered the in-flight save — drives WHICH button spins.
  bool _pendingIsSkip = false;

  // Direction of the last step change: +1 next/skip, -1 back. Drives the
  // horizontal slide of the AnimatedSwitcher (web AnimatePresence direction).
  int _direction = 1;

  final ScrollController _scrollController = ScrollController();
  bool _showScrollGradient = false;

  // Per-step collected data (keyed by 1-based step), mirroring RN `screenData`.
  final Map<int, Map<String, dynamic>> _screenData = {};

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_updateScrollGradient);
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _updateScrollGradient());
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _updateScrollGradient() {
    if (!_scrollController.hasClients) return;
    final pos = _scrollController.position;
    final hasMore = pos.maxScrollExtent > 0 &&
        pos.pixels < pos.maxScrollExtent - 10;
    if (hasMore != _showScrollGradient) {
      setState(() => _showScrollGradient = hasMore);
    }
  }

  void _onScreenChange(int step, Map<String, dynamic> data) {
    setState(() => _screenData[step] = data);
  }

  void _advance() {
    final step = _currentStep!;
    if (step >= _totalSteps) {
      widget.onComplete();
    } else {
      _direction = 1;
      setState(() => _currentStep = step + 1);
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _updateScrollGradient());
    }
  }

  Future<void> _save(Map<String, dynamic> data) async {
    setState(() => _isPending = true);
    try {
      await ref
          .read(saveScreenControllerProvider)
          .save(step: _currentStep!, data: data);
      if (!mounted) return;
      _advance();
    } catch (_) {
      // Web surfaces the mutation error as a toast; do the same so a failed
      // save isn't silent. Stay on the step.
      if (mounted) _showSaveError();
    } finally {
      if (mounted) setState(() => _isPending = false);
    }
  }

  void _showSaveError() {
    showTopToast(
      context,
      tr('onboarding.saveError'),
      variant: TopToastVariant.error,
    );
  }

  void _handleNext() {
    final data = _screenData[_currentStep!];
    if (data == null) return;
    _pendingIsSkip = false;
    _save(data);
  }

  void _handleSkip() {
    _direction = 1;
    _pendingIsSkip = true;
    _save(const {});
  }

  void _handleBack() {
    _direction = -1;
    setState(() => _currentStep = (_currentStep! - 1).clamp(1, _totalSteps));
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _updateScrollGradient());
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(profileProvider).valueOrNull;
    // Resolve the resume step once (the gate computed it from the profile).
    _currentStep ??= ref.read(onboardingResumeStepProvider);
    final step = _currentStep!;

    final hasData = _screenData[step] != null;
    final isNextDisabled = _isPending || !hasData;
    final isFirstStep = step <= 1;

    return Column(
      children: [
        _Header(currentStep: step, onClose: widget.onClose),
        Expanded(
          child: Stack(
            children: [
              SingleChildScrollView(
                controller: _scrollController,
                padding: const EdgeInsets.all(NhamSpacing.sp5),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                child: _StepTransition(
                  direction: _direction,
                  child: _StepBody(
                    key: ValueKey(step),
                    step: step,
                    profile: profile,
                    screenData: _screenData,
                    onChange: _onScreenChange,
                  ),
                ),
              ),
              // Bottom fade gradient — hints more content below.
              if (_showScrollGradient)
                const Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 48, // h-12
                  child: IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.bottomCenter,
                          end: Alignment.topCenter,
                          colors: [
                            NhamColors.cream, // from-[#FDFCF8]
                            Color(0x00FDFCF8), // to-transparent
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        _Footer(
          isFirstStep: isFirstStep,
          isPending: _isPending,
          pendingSkip: _isPending && _pendingIsSkip,
          pendingNext: _isPending && !_pendingIsSkip,
          isNextDisabled: isNextDisabled,
          isLastStep: step >= _totalSteps,
          onBack: _handleBack,
          onSkip: _isPending ? null : _handleSkip,
          onNext: isNextDisabled ? null : _handleNext,
        ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.currentStep, required this.onClose});

  final int currentStep;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: NhamSpacing.sp5,
        vertical: NhamSpacing.sp4,
      ),
      decoration: const BoxDecoration(
        // border @60%
        border: Border(bottom: BorderSide(color: NhamColors.borderSoft)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          StepIndicator(currentStep: currentStep, totalSteps: _totalSteps),
          // RN: padding space[2] + marginRight -space[2] (hugs the edge). The
          // header's own paddingHorizontal sp5 keeps it off the true edge.
          if (onClose != null)
            Transform.translate(
              offset: const Offset(NhamSpacing.sp2, 0),
              child: _CloseButton(onTap: onClose!),
            ),
        ],
      ),
    );
  }
}

/// Close X: rounded-full p-2 text-[#8B8682] hover:bg-[#EAE7E0]/50
/// hover:text-[#2C2416]. Touch highlight = filled circle + icon darken.
class _CloseButton extends StatefulWidget {
  const _CloseButton({required this.onTap});
  final VoidCallback onTap;

  @override
  State<_CloseButton> createState() => _CloseButtonState();
}

class _CloseButtonState extends State<_CloseButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: Container(
        padding: const EdgeInsets.all((NhamIcons.hit - NhamIcons.size) / 2),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: _pressed ? NhamColors.borderHalf : Colors.transparent,
        ),
        child: Icon(
          LucideIcons.x,
          size: NhamIcons.size,
          color: _pressed ? NhamColors.text : NhamColors.textHelp,
        ),
      ),
    );
  }
}

class _StepBody extends StatelessWidget {
  const _StepBody({
    super.key,
    required this.step,
    required this.profile,
    required this.screenData,
    required this.onChange,
  });

  final int step;
  final ProfileRow? profile;
  final Map<int, Map<String, dynamic>> screenData;
  final void Function(int, Map<String, dynamic>) onChange;

  @override
  Widget build(BuildContext context) => _buildStep(context);

  Widget _buildStep(BuildContext context) {
    final locale = context.locale.languageCode;
    switch (step) {
      case 1:
        final saved = screenData[1];
        final defaults = saved != null
            ? StepOneData(
                countryOfOrigin: saved['countryOfOrigin'] as String?,
                countryOfResidence: saved['countryOfResidence'] as String?,
                preferredLocale:
                    (saved['preferredLocale'] as String?) ?? locale,
              )
            : buildStepOneDefaults(
                activeLocale: locale,
                countryOfOrigin: profile?.countryOfOrigin,
                countryOfResidence: profile?.countryOfResidence,
                profilePreferredLocale: profile?.preferredLocale,
              );
        return ScreenOrigin(
          defaultValues: defaults,
          onChange: (d) => onChange(1, d),
        );
      case 2:
        final base = _buildScreenTwoDefaults(profile);
        final saved = screenData[2];
        final defaults = saved == null
            ? base
            : ScreenTwoDefaults(
                biologicalSex:
                    (saved['biologicalSex'] as String?) ?? base.biologicalSex,
                weightKg: (saved['weightKg'] as num?)?.toDouble() ??
                    base.weightKg,
                heightCm: (saved['heightCm'] as num?)?.toInt() ?? base.heightCm,
                age: (saved['age'] as num?)?.toInt() ?? base.age,
                activityLevel:
                    (saved['activityLevel'] as String?) ?? base.activityLevel,
                goal: (saved['goal'] as String?) ?? base.goal,
                aggression: saved.containsKey('aggression')
                    ? (saved['aggression'] as num?)?.toDouble()
                    : base.aggression,
                carbSplit: (saved['carbSplit'] as String?) ?? base.carbSplit,
                deficitOverride:
                    (saved['deficitOverride'] as num?)?.toDouble() ??
                        base.deficitOverride,
              );
        return ScreenBodyMetrics(
          defaultValues: defaults,
          onChange: (v) => onChange(2, v.toJson()),
        );
      default:
        final saved = screenData[3];
        final defaults = saved != null
            ? ScreenThreeDefaults(
                oilUsage: saved['oilUsage'] as String?,
                defaultRicePortion: saved['defaultRicePortion'] as String?,
                sugarBraised: saved['sugarBraised'] as String?,
                defaultProteinPortion: saved['defaultProteinPortion'] as String?,
                brothConsumption: saved['brothConsumption'] as String?,
              )
            : _buildScreenThreeDefaults(profile);
        return ScreenCooking(
          defaultValues: defaults,
          onChange: (d) => onChange(3, d),
        );
    }
  }

  ScreenTwoDefaults _buildScreenTwoDefaults(ProfileRow? p) {
    return ScreenTwoDefaults(
      biologicalSex: p?.biologicalSex,
      weightKg: p?.weightKg,
      heightCm: p?.heightCm,
      age: p?.age,
      activityLevel: p?.activityLevel ??
          activityLevelToString(WizardDefaults.activityLevel),
      goal: p?.goal ?? WizardDefaults.goal.name,
      aggression: _parseAggression(p?.aggression, WizardDefaults.aggression),
      carbSplit: p?.carbSplit ?? 'moderate_carb',
      deficitOverride: WizardDefaults.deficitOverride,
    );
  }

  ScreenThreeDefaults _buildScreenThreeDefaults(ProfileRow? p) {
    return ScreenThreeDefaults(
      oilUsage: p?.oilUsage,
      defaultRicePortion: p?.defaultRicePortion,
      sugarBraised: p?.sugarBraised,
      defaultProteinPortion: p?.defaultProteinPortion,
      brothConsumption: p?.brothConsumption,
    );
  }
}

/// Replicates the web AnimatePresence(mode='wait') horizontal slide+fade on
/// step change: incoming slides from x: direction*20px → 0 while fading in;
/// outgoing slides to x: direction*-20px while fading out. The spring
/// (stiffness 400, damping 40) is approximated by easeOutCubic over ~250ms.
class _StepTransition extends StatelessWidget {
  const _StepTransition({required this.direction, required this.child});

  final int direction;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 320),
      switchInCurve: Curves.easeInOutCubic,
      switchOutCurve: Curves.easeInOutCubic,
      transitionBuilder: (child, animation) {
        final incoming = child.key == this.child.key;
        // A clean page sweep: incoming slides in from one side, outgoing slides
        // out the other (the outgoing child's `animation` runs 1→0). Fractional
        // offset (~22% of width) reads as a deliberate sweep, not a nudge.
        final begin = incoming
            ? Offset(direction * 0.22, 0)
            : Offset(-direction * 0.22, 0);
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position:
                Tween<Offset>(begin: begin, end: Offset.zero).animate(animation),
            child: child,
          ),
        );
      },
      layoutBuilder: (currentChild, previousChildren) => Stack(
        alignment: Alignment.topCenter,
        children: [
          ...previousChildren,
          if (currentChild != null) currentChild,
        ],
      ),
      child: child,
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({
    required this.isFirstStep,
    required this.isPending,
    required this.pendingSkip,
    required this.pendingNext,
    required this.isNextDisabled,
    required this.isLastStep,
    required this.onBack,
    required this.onSkip,
    required this.onNext,
  });

  final bool isFirstStep;
  final bool isPending;
  final bool pendingSkip;
  final bool pendingNext;
  final bool isNextDisabled;
  final bool isLastStep;
  final VoidCallback onBack;
  final VoidCallback? onSkip;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: NhamSpacing.sp5,
        vertical: NhamSpacing.sp4,
      ),
      decoration: const BoxDecoration(
        color: NhamColors.track50,
        border: Border(top: BorderSide(color: NhamColors.borderSoft)), // /60
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Back — opacity 0 (still occupies space) on the first step.
          Opacity(
            opacity: isFirstStep ? 0 : 1,
            child: IgnorePointer(
              ignoring: isFirstStep || isPending,
              child: _BackButton(onTap: onBack),
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _SkipButton(onTap: onSkip, pending: pendingSkip),
              const SizedBox(width: NhamSpacing.sp3),
              _NextButton(
                pending: pendingNext,
                isLastStep: isLastStep,
                onTap: onNext,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Back: gap-2 ArrowLeft(16) + text-[14px]; hover:text-[#2C2416] darken.
class _BackButton extends StatefulWidget {
  const _BackButton({required this.onTap});
  final VoidCallback onTap;

  @override
  State<_BackButton> createState() => _BackButtonState();
}

class _BackButtonState extends State<_BackButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final color = _pressed ? NhamColors.text : NhamColors.textHelp;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(LucideIcons.arrowLeft, size: 16, color: color),
          const SizedBox(width: NhamSpacing.sp2),
          Text(
            tr('common.back'),
            style: dashBody(color: color, weight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}

class _SkipButton extends StatefulWidget {
  const _SkipButton({required this.onTap, required this.pending});
  final VoidCallback? onTap;
  final bool pending;

  @override
  State<_SkipButton> createState() => _SkipButtonState();
}

class _SkipButtonState extends State<_SkipButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // hover:bg-[#EAE7E0]/50 + hover:text-[#2C2416]
    final textColor = _pressed ? NhamColors.text : NhamColors.textHelp;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown:
          widget.onTap == null ? null : (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp4,
          vertical: 10,
        ),
        decoration: BoxDecoration(
          color: _pressed ? NhamColors.borderHalf : Colors.transparent,
          borderRadius: BorderRadius.circular(NhamRadii.buttonXl), // rounded-xl
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              tr('common.skip'),
              style: dashBody(color: textColor, weight: FontWeight.w500),
            ),
            const SizedBox(width: 6),
            // Skipping spins HERE (replacing the skip glyph), not on Next.
            if (widget.pending)
              SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(textColor),
                ),
              )
            else
              Icon(LucideIcons.skipForward, size: 14, color: textColor),
          ],
        ),
      ),
    );
  }
}

class _NextButton extends StatefulWidget {
  const _NextButton({
    required this.pending,
    required this.isLastStep,
    required this.onTap,
  });

  final bool pending;
  final bool isLastStep;
  final VoidCallback? onTap;

  @override
  State<_NextButton> createState() => _NextButtonState();
}

class _NextButtonState extends State<_NextButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final pending = widget.pending;
    final isLastStep = widget.isLastStep;
    final onTap = widget.onTap;
    final disabled = onTap == null;
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: disabled ? null : (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp5,
            vertical: 10,
          ),
          decoration: BoxDecoration(
            // hover:bg-[#1C1917] darken on press
            color: _pressed ? NhamColors.btnDarkHover : NhamColors.text,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl), // rounded-xl
            boxShadow: const [NhamShadows.sm], // shadow-sm
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Label stays put; the trailing arrow is what becomes the spinner.
              Text(
                isLastStep ? tr('common.finish') : tr('common.next'),
                style: dashBody(color: NhamColors.cream, weight: FontWeight.w500),
              ),
              const SizedBox(width: NhamSpacing.sp2),
              if (pending)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor:
                        AlwaysStoppedAnimation<Color>(NhamColors.cream),
                  ),
                )
              else
                const Icon(LucideIcons.arrowRight,
                    size: 16, color: NhamColors.cream),
            ],
          ),
        ),
      ),
    );
  }
}
