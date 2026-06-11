import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/session_provider.dart';
import '../features/onboarding/providers/onboarding_providers.dart';
import '../theme/nham_colors.dart';
import '../theme/nham_theme.dart';
import '../theme/nham_typography.dart';

/// In-flow app header.
///
/// A flexible center [child] slot (the logging screen fills it with the
/// timeline date strip), an optional left back button ([onBack]), and an
/// optional 32px account avatar in the right slot ([showAvatar]) that pushes
/// the Settings screen. The avatar carries the onboarding pulse-dot when setup
/// is incomplete. Empty side slots are mirrored so the center slot stays
/// centered.
///
/// When [expanded] is true the header morphs (chip pill → full-width strip):
/// the full row is handed to [child] (the timeline week strip) and the side
/// slots are dropped so the strip isn't squeezed.
class AppHeader extends StatelessWidget {
  const AppHeader({
    this.child,
    this.expanded = false,
    this.showAvatar = false,
    this.onBack,
    super.key,
  });

  /// Center slot content.
  final Widget? child;

  /// Strip mode — hand the full row to [child] and drop the side slots.
  final bool expanded;

  /// Show the 32px account avatar in the right slot (pushes Settings).
  final bool showAvatar;

  /// When non-null, a back chevron fills the left slot (Settings/pushed screens).
  final VoidCallback? onBack;

  // Web animates the container shape over 0.28s with this easing.
  static const Duration _morphDuration = Duration(milliseconds: 280);
  static const Curve _morphCurve = Cubic(0.16, 1, 0.3, 1);
  static const Duration _fadeDuration = Duration(milliseconds: 150);

  // Square hit target for the side slots.
  static const double _hit = 44;

  @override
  Widget build(BuildContext context) {
    final Widget leading = onBack != null
        ? _BackButton(onBack: onBack!)
        : const SizedBox(width: _hit, height: _hit);
    final Widget trailing = showAvatar
        ? const _AccountAvatar()
        : const SizedBox(width: _hit, height: _hit);

    final Widget content = expanded
        ? _FadeKey(
            // Re-key on the mode so AnimatedSwitcher cross-fades on morph.
            key: const ValueKey('expanded'),
            duration: _fadeDuration,
            child: child ?? const SizedBox.shrink(),
          )
        : Row(
            key: const ValueKey('collapsed'),
            children: [
              leading,
              Expanded(
                child: _FadeKey(
                  duration: _fadeDuration,
                  child: Align(
                    alignment: Alignment.center,
                    child: child ?? const SizedBox.shrink(),
                  ),
                ),
              ),
              trailing,
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
        onTap: widget.onBack,
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

/// 32px account avatar disc — a tan-gradient circle with the user's initial,
/// pushing the Settings screen (Cupertino swipe-back). When onboarding is
/// incomplete a pulsing 8px accent dot with a 2px cream ring sits at the
/// top-right (the setup indicator that lived on the old hamburger).
class _AccountAvatar extends ConsumerStatefulWidget {
  const _AccountAvatar();

  @override
  ConsumerState<_AccountAvatar> createState() => _AccountAvatarState();
}

class _AccountAvatarState extends ConsumerState<_AccountAvatar> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(currentSessionProvider);
    final initial = _deriveInitial(session?.user);
    final onboardingIncomplete = ref.watch(onboardingResumeProvider);

    return Semantics(
      button: true,
      label: tr('app.userMenu.openMenu'),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: () => context.push('/settings'),
        child: SizedBox(
          width: AppHeader._hit,
          height: AppHeader._hit,
          child: Center(
            child: AnimatedScale(
              scale: _pressed ? 0.92 : 1,
              duration: const Duration(milliseconds: 150),
              child: Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Color(0x66C9A87C), // accent @ 40%
                          Color(0x8CE8D5B5), // border @ 55%
                        ],
                      ),
                      border: Border.all(
                        color: const Color(0x40C9A87C), // accent @ 25%
                        width: 1,
                      ),
                    ),
                    child: Text(
                      initial,
                      style: NhamTextStyles.sansBold(
                        fontSize: 13,
                      ).copyWith(color: NhamColors.btn),
                    ),
                  ),
                  if (onboardingIncomplete)
                    const Positioned(top: -1, right: -1, child: _OnboardingDot()),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  static String _deriveInitial(User? user) {
    final meta = user?.userMetadata;
    final raw = (meta?['displayName'] ?? meta?['full_name'] ?? meta?['name']);
    String source = '';
    if (raw is String && raw.trim().isNotEmpty) {
      source = raw.trim();
    } else if (user?.email != null && user!.email!.contains('@')) {
      source = user.email!.split('@').first;
    } else {
      source = user?.email ?? '';
    }
    if (source.isEmpty) return '·';
    return source.characters.first.toUpperCase();
  }
}

/// 8px accent dot with a 2px cream ring, gently pulsing — the unfinished-setup
/// indicator on the avatar (OnboardingDot, animate-pulse-dot).
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
