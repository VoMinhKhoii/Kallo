import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../providers/onboarding_providers.dart';
import 'onboarding_wizard.dart';

/// Presents the onboarding wizard as a dismissible modal — the sidebar
/// "Continue" / resume entry point.
///
/// This is the floating-card presentation: a translucent scrim, an r28 cream
/// card, and the framer-motion entrance (opacity 0→1, scale 0.95→1, y 10→0)
/// that used to live in `OnboardingScreen`. The FORCED first-run uses the full
/// page ([OnboardingScreen]) instead. Finishing routes to the `/welcome` setup
/// interstitial; closing just dismisses and refreshes the resume nudge.
Future<void> showOnboardingDialog(BuildContext context, WidgetRef ref) {
  // Capture the router up front — the callbacks run after the dialog pops, when
  // the originating (sidebar) context may already be deactivated.
  final router = GoRouter.of(context);

  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    barrierColor: const Color(0x332C2416), // rgba(44,36,22,0.2)
    transitionDuration: const Duration(milliseconds: 250),
    pageBuilder: (ctx, _, __) {
      final insets = MediaQuery.paddingOf(ctx);
      return Padding(
        padding: EdgeInsets.only(
          top: insets.top + NhamSpacing.sp3,
          bottom: insets.bottom + NhamSpacing.sp3,
          left: NhamSpacing.sp3,
          right: NhamSpacing.sp3,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          // Material provides the cream surface AND the Material ancestor the
          // step-2 TextFields need (the full page gets this from its Scaffold;
          // showGeneralDialog has no Scaffold, so supply one here).
          child: Material(
            color: NhamColors.cream,
            child: OnboardingWizard(
              onComplete: () {
                Navigator.of(ctx).pop();
                router.go('/welcome');
              },
              onClose: () {
                Navigator.of(ctx).pop();
                ref.invalidate(profileProvider); // refresh the resume nudge
              },
            ),
          ),
        ),
      );
    },
    transitionBuilder: (ctx, animation, _, child) {
      final eased = Curves.easeOut.transform(animation.value);
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
  );
}
