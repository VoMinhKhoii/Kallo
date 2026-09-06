import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/brand/wordmark_bar.dart';
import '../../../shared/widgets/typography/meta_action.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';

/// The paywall's chrome: close glyph left, the wordmark centred, "Stay on
/// Free" right — the same [WordmarkBar] the onboarding steps wear, so the last
/// screen of the flow does not change shape under the mark.
class PaywallHeader extends StatelessWidget {
  const PaywallHeader({
    required this.gutter,
    required this.onClose,
    this.onStayFree,
    super.key,
  });

  /// The band's own gutter. The row insets by LESS: the 10pt of slack in a
  /// 44pt target around a 24pt glyph is paid out of it, which puts the glyph's
  /// edge on the title's line.
  final double gutter;

  final VoidCallback onClose;

  /// Absent on the premium / loading faces — there is no Free to stay on.
  final VoidCallback? onStayFree;

  @override
  Widget build(BuildContext context) => WordmarkBar(
    gutterInset: gutter - (KalloIcons.hit - KalloIcons.primary) / 2,
    leading: _close(context),
    trailing: onStayFree == null
        ? null
        // Padded inside the target: the label stands off the edge and the
        // slack it stands on is tappable.
        : MetaAction(
            label: tr('paywall.stayFree'),
            onTap: onStayFree,
            padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp2),
          ),
  );

  Widget _close(BuildContext context) => Semantics(
        button: true,
        label: tr('common.close'),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onClose,
          child: const SizedBox(
            width: KalloIcons.hit,
            height: KalloIcons.hit,
            child: Icon(
              LucideIcons.x300,
              size: KalloIcons.primary,
              color: kInk,
            ),
          ),
        ),
      );
}
