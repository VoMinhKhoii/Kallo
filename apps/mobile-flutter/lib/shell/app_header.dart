import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/onboarding/providers/onboarding_providers.dart';
import '../theme/nham_colors.dart';
import '../theme/nham_theme.dart';
import 'tab_scaffold.dart';

/// In-flow mobile header — ported 1:1 from the RN `AppHeader`
/// (`components/app/app-header.tsx`).
///
/// A hamburger button on the left that triggers [onMenu], a flexible center
/// [child] slot (the logging screen fills it with the timeline date strip,
/// like the web header slot), and a right spacer mirroring the hamburger so
/// the slot stays centered.
///
/// When [expanded] is true the header morphs (chip pill → full-width strip):
/// the full row is handed to [child] (the timeline week strip) and the
/// hamburger + spacer are dropped so the strip isn't squeezed — mirroring the
/// web header's data-strip-mode contract. The container width/shape animates
/// over 280ms with the same `cubic-bezier(0.16, 1, 0.3, 1)` easing; the slot
/// cross-fades in over 150ms.
///
/// lucide-react-native `Menu` → Material `Icons.menu`.
class AppHeader extends StatelessWidget {
  const AppHeader({this.child, this.expanded = false, this.onMenu, super.key});

  /// Center slot content.
  final Widget? child;

  /// Strip mode — hand the full row to [child] and drop the hamburger/spacer.
  final bool expanded;

  /// Hamburger tap handler. When null the button falls back to opening the
  /// shell's left nav drawer via [NavDrawerScope] — so no feature screen needs
  /// to pass a handler (matches the web Sheet trigger).
  final VoidCallback? onMenu;

  // Web animates the container shape over 0.28s with this easing.
  static const Duration _morphDuration = Duration(milliseconds: 280);
  static const Curve _morphCurve = Cubic(0.16, 1, 0.3, 1);
  static const Duration _fadeDuration = Duration(milliseconds: 150);

  // RN: HIT = 44 (square hit target for the hamburger + the mirrored spacer).
  static const double _hit = 44;

  @override
  Widget build(BuildContext context) {
    final Widget content =
        expanded
            ? _FadeKey(
              // Re-key on the mode so AnimatedSwitcher cross-fades on morph.
              key: const ValueKey('expanded'),
              duration: _fadeDuration,
              child: child ?? const SizedBox.shrink(),
            )
            : Row(
              key: const ValueKey('collapsed'),
              children: [
                _MenuButton(onMenu: onMenu),
                Expanded(
                  child: _FadeKey(
                    duration: _fadeDuration,
                    child: Align(
                      alignment: Alignment.center,
                      child: child ?? const SizedBox.shrink(),
                    ),
                  ),
                ),
                const SizedBox(width: _hit, height: _hit),
              ],
            );

    return Padding(
      padding: const EdgeInsets.only(bottom: NhamSpacing.sp1),
      child: AnimatedSize(
        duration: _morphDuration,
        curve: _morphCurve,
        child: AnimatedSwitcher(
          duration: _morphDuration,
          switchInCurve: _morphCurve,
          switchOutCurve: _morphCurve,
          child: content,
        ),
      ),
    );
  }
}

/// Simple fade-in on first mount, mirroring RN's `FadeIn.duration(150)`.
class _FadeKey extends StatefulWidget {
  const _FadeKey({required this.child, required this.duration, super.key});

  final Widget child;
  final Duration duration;

  @override
  State<_FadeKey> createState() => _FadeKeyState();
}

class _FadeKeyState extends State<_FadeKey>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: widget.duration,
  )..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(opacity: _c, child: widget.child);
  }
}

/// The hamburger button. 44×44 hit area, radius 6 (rounded-md), 20px Menu icon
/// in espresso `text`, with a hover@60% press fill animated over ~150ms
/// (mobile-nav.tsx:99 `transition-colors hover:bg-nham-hover/60`). When
/// onboarding is incomplete, a pulsing 8px accent dot with a 2px cream ring
/// sits at top:6 right:6 (mobile-nav.tsx:102-104 + OnboardingDot).
class _MenuButton extends ConsumerStatefulWidget {
  const _MenuButton({required this.onMenu});

  final VoidCallback? onMenu;

  @override
  ConsumerState<_MenuButton> createState() => _MenuButtonState();
}

class _MenuButtonState extends ConsumerState<_MenuButton> {
  bool _pressed = false;

  void _handleTap() {
    final onMenu = widget.onMenu;
    if (onMenu != null) {
      onMenu();
      return;
    }
    NavDrawerScope.maybeOf(context)?.open();
  }

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
        onTap: _handleTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeInOut,
          width: AppHeader._hit,
          height: AppHeader._hit,
          decoration: BoxDecoration(
            color: _pressed ? NhamColors.hover40 : null,
            borderRadius: BorderRadius.circular(NhamRadii.sm),
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              const Icon(Icons.menu, size: 20, color: NhamColors.text),
              if (onboardingIncomplete)
                const Positioned(top: 6, right: 6, child: _OnboardingDot()),
            ],
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
  )..repeat(reverse: true);

  late final Animation<double> _opacity = Tween<double>(
    begin: 1,
    end: 0.45,
  ).animate(CurvedAnimation(parent: _c, curve: Curves.easeInOut));

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
