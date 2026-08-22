import 'package:flutter/material.dart';

import '../../theme/kallo_colors.dart';

class InviteBadge extends StatelessWidget {
  const InviteBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 8,
      height: 8,
      decoration: const BoxDecoration(
        color: KalloColors.accent,
        shape: BoxShape.circle,
      ),
    );
  }
}

/// 8px accent dot with a 2px cream ring, gently pulsing — the unfinished-setup
/// indicator on the hamburger (OnboardingDot, animate-pulse-dot).
class OnboardingDot extends StatefulWidget {
  const OnboardingDot({super.key});

  @override
  State<OnboardingDot> createState() => _OnboardingDotState();
}

class _OnboardingDotState extends State<OnboardingDot>
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
          color: KalloColors.accent,
          shape: BoxShape.circle,
          border: Border.all(color: KalloColors.surface, width: 2),
        ),
      ),
    );
  }
}
