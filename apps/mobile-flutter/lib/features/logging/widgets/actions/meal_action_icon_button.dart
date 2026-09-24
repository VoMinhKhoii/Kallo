import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../shared/widgets/badges/premium_dot.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/logging_spacing.dart';

class MealActionIconButton extends StatelessWidget {
  const MealActionIconButton({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
    this.active = false,
    this.danger = false,
    this.pending = false,
    this.toggled,
    this.locked = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool active;
  final bool danger;
  final bool pending;

  /// Screen-reader toggle state for on/off actions (the circle-share toggle);
  /// null for plain one-shot actions.
  final bool? toggled;

  /// The user's plan lacks this action: a [PremiumDot] on the glyph's corner.
  /// The caller routes the tap to the paywall; the glyph keeps its colour.
  final bool locked;

  @override
  Widget build(BuildContext context) {
    // Quiet by default and ink once selected (never tan): at the action row's
    // 24pt these are the card's controls, not its content, so muted is what
    // keeps them from out-weighing the meal above them — and the warm wash plus
    // the step to ink is then a real change of state rather than a wash alone.
    final foreground =
        danger
            ? KalloColors.danger
            : active
            ? KalloColors.text
            : KalloColors.textMuted;
    final enabled = onTap != null && !pending;

    // No `Tooltip` here any more. iOS has no tooltips, and a dark label
    // appearing under the thumb after a hold is a distinctly Android
    // affordance — one that also collides with `showKalloAnchoredMenu`, the
    // app's real long-press gesture. It cost nothing to remove: it already
    // carried `excludeFromSemantics: true` because the Semantics below
    // names the button, so the label is unchanged for VoiceOver.
    return Semantics(
      button: true,
      enabled: enabled,
      toggled: toggled,
      label: locked ? '$label, ${'paywall.premiumFeature'.tr()}' : label,
      child: Material(
        color: Colors.transparent,
        child: InkResponse(
          onTap:
              enabled
                  ? () {
                    HapticFeedback.selectionClick();
                    onTap!();
                  }
                  : null,
          // Both washes — the selected fill and the pressed splash — hug the
          // glyph rather than filling the hit box. The tap target stays
          // [LoggingIcons.hit] for accessibility; a selected action reads as
          // a small chip around its icon, not a 36pt block under the card.
          radius: LoggingIcons.wash / 2,
          containedInkWell: true,
          highlightShape: BoxShape.rectangle,
          borderRadius: BorderRadius.circular(KalloRadii.md),
          child: SizedBox.square(
            dimension: LoggingIcons.hit,
            child: Center(
              // [Ink], not a Container: ink reactions paint onto the ancestor
              // Material, so an opaque Container here would sit ON TOP of the
              // splash and swallow the press feedback on a selected action.
              // Ink paints its decoration into that same Material, below the
              // splash.
              child: Ink(
                width: LoggingIcons.wash,
                height: LoggingIcons.wash,
                decoration: BoxDecoration(
                  color: active ? KalloColors.hover : Colors.transparent,
                  borderRadius: BorderRadius.circular(KalloRadii.md),
                ),
                child: Center(
                  child:
                      pending
                          ? CupertinoActivityIndicator(
                            // Sits in the glyph's own footprint, so the row
                            // doesn't jump when an action goes pending: the
                            // indicator is a square of radius * 2.
                            radius: (LoggingIcons.action - 6) / 2,
                            color: foreground,
                          )
                          : PremiumDot(
                            show: locked,
                            child: Icon(
                              icon,
                              size: LoggingIcons.action,
                              color: foreground,
                            ),
                          ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
