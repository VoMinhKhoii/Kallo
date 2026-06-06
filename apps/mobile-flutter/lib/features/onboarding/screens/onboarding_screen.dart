import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../models/onboarding.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/constants.dart';
import '../data/profile_row.dart';
import '../logic/step_one_defaults.dart';
import '../providers/onboarding_providers.dart';
import '../widgets/step_indicator.dart';
import 'screen_body_metrics.dart';
import 'screen_cooking.dart';
import 'screen_origin.dart';

const int _totalSteps = kOnboardingTotalSteps;

double? _parseAggression(String? raw, double fallback) {
  if (raw == null || raw.isEmpty) return fallback;
  final n = double.tryParse(raw);
  return n ?? fallback;
}

/// RN port of `components/onboarding/wizard/wizard-modal.tsx` + `onboarding-gate`.
///
/// The router mounts this as the standalone `/onboarding` route (RN mounted it
/// as a fade Modal overlay). We render the same dialog chrome full-screen: a
/// step indicator + close in the header, a scrollable per-step body, and a
/// back / skip / next footer. Next/Skip save the step then advance; finishing
/// invalidates the shared profile cache and returns to `/dashboard`.
///
/// lucide icons → Material: `X`→[Icons.close], `ArrowLeft`→[Icons.arrow_back],
/// `ArrowRight`→[Icons.arrow_forward], `SkipForward`→[Icons.skip_next].
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen>
    with SingleTickerProviderStateMixin {
  int? _currentStep;
  bool _isPending = false;

  // Direction of the last step change: +1 next/skip, -1 back. Drives the
  // horizontal slide of the AnimatedSwitcher (web AnimatePresence direction).
  int _direction = 1;

  // Web framer-motion modal entrance: opacity 0→1, scale 0.95→1, y 10→0.
  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 250),
  )..forward();

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
    _entrance.dispose();
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
      _onComplete();
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
      // Surface stays on the step; RN leaves it to the mutation error toast.
    } finally {
      if (mounted) setState(() => _isPending = false);
    }
  }

  void _handleNext() {
    final data = _screenData[_currentStep!];
    if (data == null) return;
    _save(data);
  }

  void _handleSkip() {
    _direction = 1;
    _save(const {});
  }

  void _handleBack() {
    _direction = -1;
    setState(() => _currentStep = (_currentStep! - 1).clamp(1, _totalSteps));
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _updateScrollGradient());
  }

  void _onComplete() {
    ref.invalidate(profileProvider);
    if (mounted) context.go('/dashboard');
  }

  void _onClose() {
    // RN's X keeps the wizard closed for the session; with the router model the
    // wizard is the whole route, so closing returns to the app shell.
    if (mounted) context.go('/dashboard');
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

    final insets = MediaQuery.paddingOf(context);

    return Scaffold(
      backgroundColor: const Color(0x332C2416), // backdrop rgba(44,36,22,0.2)
      body: Padding(
        padding: EdgeInsets.only(
          top: insets.top + NhamSpacing.sp3,
          bottom: insets.bottom + NhamSpacing.sp3,
          left: NhamSpacing.sp3,
          right: NhamSpacing.sp3,
        ),
        child: AnimatedBuilder(
          animation: _entrance,
          builder: (context, child) {
            final t = _entrance.value;
            final eased = Curves.easeOut.transform(t);
            return Opacity(
              opacity: eased,
              child: Transform.translate(
                offset: Offset(0, (1 - eased) * 10), // y: 10 → 0
                child: Transform.scale(
                  scale: 0.95 + 0.05 * eased, // scale: 0.95 → 1
                  child: child,
                ),
              ),
            );
          },
          child: ClipRRect(
            borderRadius: BorderRadius.circular(28),
            child: Container(
              color: NhamColors.cream,
              child: Column(
                children: [
                  _Header(currentStep: step, onClose: _onClose),
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
                    isNextDisabled: isNextDisabled,
                    isLastStep: step >= _totalSteps,
                    onBack: _handleBack,
                    onSkip: _isPending ? null : _handleSkip,
                    onNext: isNextDisabled ? null : _handleNext,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.currentStep, required this.onClose});

  final int currentStep;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: NhamSpacing.sp5,
        vertical: NhamSpacing.sp4,
      ),
      decoration: const BoxDecoration(
        // border-[#EAE7E0]/60
        border: Border(bottom: BorderSide(color: Color(0x99EAE7E0))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          StepIndicator(currentStep: currentStep, totalSteps: _totalSteps),
          // RN: padding space[2] + marginRight -space[2] (hugs the edge). The
          // header's own paddingHorizontal sp5 keeps it off the true edge.
          Transform.translate(
            offset: const Offset(NhamSpacing.sp2, 0),
            child: _CloseButton(onTap: onClose),
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
        padding: const EdgeInsets.all(NhamSpacing.sp2),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: _pressed ? const Color(0x80EAE7E0) : Colors.transparent,
        ),
        child: Icon(
          Icons.close,
          size: 20,
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
      duration: const Duration(milliseconds: 250),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeOutCubic,
      transitionBuilder: (child, animation) {
        final incoming = child.key == this.child.key;
        // 20px expressed as a fraction; SlideTransition uses fractional offset
        // of the child's size, so use a small Tween via Transform instead.
        final dx = incoming ? direction * 20.0 : direction * -20.0;
        return FadeTransition(
          opacity: animation,
          child: AnimatedBuilder(
            animation: animation,
            builder: (context, c) => Transform.translate(
              offset: Offset(dx * (1 - animation.value), 0),
              child: c,
            ),
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
    required this.isNextDisabled,
    required this.isLastStep,
    required this.onBack,
    required this.onSkip,
    required this.onNext,
  });

  final bool isFirstStep;
  final bool isPending;
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
        color: Color(0x80F5F4F0), // bg-[#F5F4F0]/50
        border: Border(top: BorderSide(color: Color(0x99EAE7E0))), // /60
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
              _SkipButton(onTap: onSkip),
              const SizedBox(width: NhamSpacing.sp3),
              _NextButton(
                isPending: isPending,
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
          Icon(Icons.arrow_back, size: 16, color: color),
          const SizedBox(width: NhamSpacing.sp2),
          Text(
            tr('common.back'),
            style:
                NhamTextStyles.sansMedium(fontSize: 14).copyWith(color: color),
          ),
        ],
      ),
    );
  }
}

class _SkipButton extends StatefulWidget {
  const _SkipButton({required this.onTap});
  final VoidCallback? onTap;

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
          color: _pressed ? const Color(0x80EAE7E0) : Colors.transparent,
          borderRadius: BorderRadius.circular(NhamRadii.buttonXl), // rounded-xl
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              tr('common.skip'),
              style: NhamTextStyles.sansMedium(fontSize: 14)
                  .copyWith(color: textColor),
            ),
            const SizedBox(width: 6),
            Icon(Icons.skip_next, size: 14, color: textColor),
          ],
        ),
      ),
    );
  }
}

class _NextButton extends StatefulWidget {
  const _NextButton({
    required this.isPending,
    required this.isLastStep,
    required this.onTap,
  });

  final bool isPending;
  final bool isLastStep;
  final VoidCallback? onTap;

  @override
  State<_NextButton> createState() => _NextButtonState();
}

class _NextButtonState extends State<_NextButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final isPending = widget.isPending;
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
              if (isPending)
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
                Text(
                  isLastStep ? tr('common.finish') : tr('common.next'),
                  style: NhamTextStyles.sansMedium(fontSize: 14)
                      .copyWith(color: NhamColors.cream),
                ),
              const SizedBox(width: NhamSpacing.sp2),
              const Icon(Icons.arrow_forward, size: 16, color: NhamColors.cream),
            ],
          ),
        ),
      ),
    );
  }
}
