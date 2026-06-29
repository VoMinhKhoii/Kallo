import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../features/onboarding/providers/onboarding_providers.dart';
import '../theme/nham_colors.dart';
import '../theme/nham_theme.dart';
import 'tab_scaffold.dart';

/// In-flow app header.
///
/// Left slot: a hamburger that opens the left nav drawer (via [NavDrawerScope]),
/// or a back chevron when [onBack] is given (pushed screens like Settings). A
/// flexible center [child] slot (the dashboard greeting, the logging date chip),
/// and a right spacer mirroring the left slot so the center stays centered.
///
/// The hamburger carries the onboarding pulse-dot when setup is incomplete
/// (the indicator that used to live on the retired avatar disc / bottom bar).
class AppHeader extends StatelessWidget {
  const AppHeader({this.child, this.onBack, this.trailing, super.key});

  /// Center slot content.
  final Widget? child;

  /// When non-null, a back chevron replaces the hamburger (pushed screens).
  final VoidCallback? onBack;

  /// Optional right-slot content (e.g. the nutrition date toggle). When null a
  /// 44×44 spacer mirrors the leading slot so [child] stays centered.
  final Widget? trailing;

  // Square hit target for the side slots.
  static const double _hit = 44;

  @override
  Widget build(BuildContext context) {
    final Widget leading =
        onBack != null ? _BackButton(onBack: onBack!) : const AppMenuButton();

    return Padding(
      padding: const EdgeInsets.only(bottom: NhamSpacing.sp1),
      child: Row(
        children: [
          leading,
          Expanded(
            child: Align(
              alignment: Alignment.center,
              child: child ?? const SizedBox.shrink(),
            ),
          ),
          // Trailing slot, or a spacer that mirrors the leading slot so the
          // center stays centered when there's nothing on the right.
          trailing ??
              const SizedBox(width: _hit, height: _hit),
        ],
      ),
    );
  }
}

/// The hamburger — 44×44 hit area, radius 6, 22px Menu glyph. Opens the shell's
/// left nav drawer via [NavDrawerScope]. Carries the onboarding pulse-dot when
/// setup is incomplete.
class AppMenuButton extends ConsumerStatefulWidget {
  const AppMenuButton({super.key});

  @override
  ConsumerState<AppMenuButton> createState() => _AppMenuButtonState();
}

class _AppMenuButtonState extends ConsumerState<AppMenuButton> {
  bool _pressed = false;

  void _open() => NavDrawerScope.maybeOf(context)?.open();

  @override
  Widget build(BuildContext context) {
    final onboardingIncomplete = ref.watch(onboardingResumeProvider);

    return Semantics(
      button: true,
      label: tr('app.shell.openMenu'),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: _open,
        child: SizedBox(
          width: AppHeader._hit,
          height: AppHeader._hit,
          child: Center(
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  curve: Curves.easeInOut,
                  width: 36,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _pressed ? NhamColors.hover40 : null,
                    borderRadius: BorderRadius.circular(NhamRadii.sm),
                  ),
                  child: const Icon(
                    LucideIcons.menu,
                    size: 22,
                    color: NhamColors.text,
                  ),
                ),
                if (onboardingIncomplete)
                  const Positioned(top: 2, right: 2, child: _OnboardingDot()),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Left-slot back chevron — 44×44 hit area, radius 6, espresso glyph.
class _BackButton extends StatefulWidget {
  const _BackButton({required this.onBack});

  final VoidCallback onBack;

  @override
  State<_BackButton> createState() => _BackButtonState();
}

class _BackButtonState extends State<_BackButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tr('common.back'),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: () {
          HapticFeedback.selectionClick();
          widget.onBack();
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeInOut,
          width: AppHeader._hit,
          height: AppHeader._hit,
          decoration: BoxDecoration(
            color: _pressed ? NhamColors.hover40 : null,
            borderRadius: BorderRadius.circular(NhamRadii.sm),
          ),
          child: const Icon(
            LucideIcons.chevronLeft,
            size: 22,
            color: NhamColors.text,
          ),
        ),
      ),
    );
  }
}

/// 8px accent dot with a 2px cream ring, gently pulsing — the unfinished-setup
/// indicator on the hamburger (OnboardingDot, animate-pulse-dot).
class _OnboardingDot extends StatefulWidget {
  const _OnboardingDot();

  @override
  State<_OnboardingDot> createState() => _OnboardingDotState();
}

class _OnboardingDotState extends State<_OnboardingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  late final Animation<double> _opacity = Tween<double>(
    begin: 1,
    end: 0.45,
  ).animate(CurvedAnimation(parent: _c, curve: Curves.easeInOut));

  @override
  void initState() {
    super.initState();
    if (!WidgetsBinding
        .instance
        .platformDispatcher
        .accessibilityFeatures
        .disableAnimations) {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          color: NhamColors.accent,
          shape: BoxShape.circle,
          border: Border.all(color: NhamColors.surface, width: 2),
        ),
      ),
    );
  }
}
