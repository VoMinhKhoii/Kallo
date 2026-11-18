import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/brand/wordmark_bar.dart';
import '../../../shared/widgets/typography/meta_action.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import 'paywall_gutter.dart';

/// The paywall's chrome: close glyph left, the wordmark centred, "Stay on
/// Free" right — the same [WordmarkBar] the onboarding steps wear, so the last
/// screen of the flow does not change shape under the mark.
class PaywallHeader extends StatelessWidget {
  const PaywallHeader({required this.onClose, this.onStayFree, super.key});

  final VoidCallback onClose;

  /// Absent on the premium face only — a subscriber has no Free to stay on.
  /// Every other face keeps it, so the paywall is always closable two ways.
  final VoidCallback? onStayFree;

  /// How far the glyph's box sits outside the column's gutter: the X's
  /// strokes start 6pt into its 24pt box, so this puts the strokes on the
  /// gutter, where the title and the table start. On a phone's 20pt gutter
  /// that is [WordmarkBar.rowInset], the onboarding header's own inset, so
  /// the glyph does not move between the last wizard screen and this one.
  static const double _glyphLead = PaywallGutter.regular - WordmarkBar.rowInset;

  @override
  Widget build(BuildContext context) {
    final inset = PaywallGutter.of(context) - _glyphLead;
    return WordmarkBar(
      gutterInset: math.max(0, inset),
      // A narrow column's gutter is less than the 44pt target's slack. The
      // glyph moves out to the edge inside its target, and the target keeps
      // its 44 points.
      leading: _close(context, math.min(0, inset)),
      trailing:
          onStayFree == null
              ? null
              // Padded inside the target: the label stands off the edge and the
              // slack it stands on is tappable.
              : MetaAction(
                label: tr('paywall.stayFree'),
                onTap: onStayFree,
                padding: const EdgeInsets.symmetric(
                  horizontal: KalloSpacing.sp2,
                ),
              ),
    );
  }

  Widget _close(BuildContext context, double shift) => Semantics(
    button: true,
    label: tr('common.close'),
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onClose,
      child: SizedBox(
        width: KalloIcons.hit,
        height: KalloIcons.hit,
        child:
            shift == 0
                ? _glyph()
                : Transform.translate(
                  offset: Offset(shift, 0),
                  child: _glyph(),
                ),
      ),
    ),
  );

  // Built per frame: the ink follows the theme.
  static Widget _glyph() =>
      Icon(LucideIcons.x300, size: KalloIcons.primary, color: kInk);
}
