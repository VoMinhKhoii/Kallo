import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

/// Segmented Sign in / Sign up toggle.
///
/// Matches web `components/auth/auth-dialog.tsx:68-84` + `tab-button.tsx`:
/// an outer `flex rounded-xl bg-[#F0EAE0]/60 p-1` (radius 12, fill #F0EAE0@60%,
/// 4px padding) holding two `flex-1 py-2.5` buttons (DM Sans medium 14,
/// tracking-tight). The active label is `#2C2416`, inactive `#8B7355/70`,
/// `transition-colors duration-200`. A white `rounded-lg` (8) pill with
/// `shadow-sm` slides between the slots via a framer `layoutId` spring
/// (stiffness 400, damping 30) — approximated here with a ~250ms ease curve.
class AuthTabToggle extends StatelessWidget {
  const AuthTabToggle({
    super.key,
    required this.signInActive,
    required this.onSignIn,
    required this.onSignUp,
    required this.signInLabel,
    required this.signUpLabel,
  });

  final bool signInActive;
  final VoidCallback onSignIn;
  final VoidCallback onSignUp;
  final String signInLabel;
  final String signUpLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4), // p-1
      decoration: BoxDecoration(
        color: _trackFill, // #F0EAE0 @ 60%
        borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final slotWidth = constraints.maxWidth / 2;
          return Stack(
            children: [
              // Sliding white pill (shadow-sm), rounded-lg (8).
              AnimatedAlign(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOutCubic,
                alignment:
                    signInActive ? Alignment.centerLeft : Alignment.centerRight,
                child: Container(
                  width: slotWidth,
                  height: _pillHeight,
                  decoration: BoxDecoration(
                    color: NhamColors.elev,
                    borderRadius: BorderRadius.circular(NhamRadii.md),
                    boxShadow: const [NhamShadows.sm],
                  ),
                ),
              ),
              Row(
                children: [
                  _TabLabel(
                    label: signInLabel,
                    active: signInActive,
                    onTap: onSignIn,
                  ),
                  _TabLabel(
                    label: signUpLabel,
                    active: !signInActive,
                    onTap: onSignUp,
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }

  // py-2.5 (10) above + below a 14px line → ~ matches the web button height.
  static const double _pillHeight = 38;

  // bg-[#F0EAE0]/60.
  static const Color _trackFill = Color(0x99F0EAE0);
}

class _TabLabel extends StatelessWidget {
  const _TabLabel({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10), // py-2.5
          child: AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 200), // transition-colors
            style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.sm).copyWith(
              color: active
                  ? NhamColors.text
                  : NhamColors.textMuted70, // #8B7355 @ 70%
              letterSpacing: -0.2, // tracking-tight
            ),
            textAlign: TextAlign.center,
            child: Text(label, textAlign: TextAlign.center),
          ),
        ),
      ),
    );
  }
}
