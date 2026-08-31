import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

// ── Auth metrics (native pass, 2026-08-31) ────────────────────────────────
// The pre-auth screens are the app's one documented exception to its page
// rhythm and to the calm type scale, so the four numbers that make them that
// exception live together here rather than being spelled at each screen.

/// Auth's side inset — the one surface that does NOT run the app's 12pt page
/// rhythm. Pre-auth is a single centred column with no cards to align to, and
/// at 12 a 50pt pill ran almost edge to edge.
const double kAuthInset = KalloSpacing.sp6;

/// Lora 26 — the heading on a pushed auth screen. One step under the welcome
/// wordmark's 40 and above the 22 the in-app greeting uses, so the three
/// serif moments never read as the same one.
const double kAuthHeading = 26;

/// The auth footer size — Terms/Privacy links, "New here?". One step under the
/// 14 body so the legal line recedes without dropping to the 12 that carries
/// real data elsewhere.
const double kAuthFootnote = 13;

/// Every full-width auth button: 50pt, fully rounded — the shape the button
/// system gives any full-width button. Named here because the welcome stack's
/// three buttons are hand-rolled around their brand marks rather than built on
/// [KalloButton], and the one thing they must never do is drift apart.
const double kAuthButtonHeight = 50;

/// The auth stack's back control: a 24pt chevron in a 44pt target, matching
/// [AppHeaderBackButton] — the same object every pushed screen in the app
/// carries. Auth used a 16pt arrow with the word "Back" beside it, which is
/// the web layout; on iOS the chevron alone is the back affordance and it
/// belongs in the corner, not inline with the copy.
class AuthBackButton extends StatelessWidget {
  const AuthBackButton({super.key, required this.onBack});

  /// Null while a request is in flight — dims and disables.
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: onBack != null,
      label: tr('common.back'),
      excludeSemantics: true,
      child: Opacity(
        opacity: onBack == null ? 0.5 : 1,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap:
              onBack == null
                  ? null
                  : () {
                    HapticFeedback.selectionClick();
                    onBack!();
                  },
          child: const SizedBox.square(
            dimension: KalloIcons.hit,
            child: Icon(
              LucideIcons.chevronLeft300,
              size: KalloIcons.size,
              color: kInk,
            ),
          ),
        ),
      ),
    );
  }
}

/// A quiet text affordance in a 44pt target — "Forgot password?", "Create an
/// account", "Back". Text-only by design: these are the alternatives to the
/// CTA above them, and a second button shape here would read as a second
/// action of equal weight.
class AuthQuietLink extends StatelessWidget {
  const AuthQuietLink({
    super.key,
    required this.label,
    required this.onTap,
    this.emphasis = false,
  });

  final String label;
  final VoidCallback? onTap;

  /// Ink + w600 + a hairline underline, for a link that finishes a sentence
  /// ("New here? **Create an account**") rather than standing on its own.
  final bool emphasis;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: KalloIcons.hit),
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
          alignment: Alignment.center,
          child: Text(
            label,
            style:
                emphasis
                    ? dashMeta(color: kInk, weight: FontWeight.w600).copyWith(
                      fontSize: kAuthFootnote,
                      decoration: TextDecoration.underline,
                      decorationColor: KalloColors.border,
                    )
                    : dashBody(color: kInkMuted, weight: FontWeight.w500),
          ),
        ),
      ),
    );
  }
}
