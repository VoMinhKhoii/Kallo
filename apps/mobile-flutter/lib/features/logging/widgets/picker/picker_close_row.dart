import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/badges/premium_chip.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/logging_spacing.dart';
import 'picker_styles.dart';

/// The band's top row: an optional [title] at the left, the close affordance at
/// the right. The `/` picker passes no title — the `/` you just typed is the
/// title. Cheat mode has no token to read back, so it names itself.
///
/// The X is NOT optional chrome — a phone keyboard has no Escape, and the band
/// is an inline sibling in the dock, not an overlay: no barrier, no
/// `PopScope`, nothing closes on a tap outside. The one other caller of
/// `onDismiss` is `PickerCollapsed`, which nobody can tap.
///
/// With [locked] (the plan lacks the band's feature) a [PremiumChip] sits just
/// left of the X.
class PickerCloseRow extends StatelessWidget {
  const PickerCloseRow({
    super.key,
    required this.onDismiss,
    this.title,
    this.locked = false,
  });

  final VoidCallback onDismiss;
  final String? title;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child:
              title == null
                  ? const SizedBox.shrink()
                  // sp4: the option rows sit sp2 into the list plus sp2 of
                  // their own, so the title starts on the same x as the names.
                  : Padding(
                    padding: const EdgeInsets.only(left: KalloSpacing.sp4),
                    child: Text(
                      // dashEyebrow does NOT upper-case — the transform lives
                      // at the call site (the KalloText casing trap).
                      title!.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: PickerStyles.eyebrow,
                    ),
                  ),
        ),
        if (locked) const PremiumChip(),
        _close(),
      ],
    );
  }

  Widget _close() {
    return Semantics(
      button: true,
      label: 'logging.relog.closePicker'.tr(),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onDismiss,
        child: const SizedBox(
          width: LoggingIcons.hit,
          height: LoggingIcons.hit,
          // White @ 70% — the notice's own dismiss glyph. Translucent only
          // because it carries no text: not held to the copy's 4.5:1.
          child: Icon(
            LucideIcons.x300,
            size: LoggingIcons.size,
            color: KalloColors.bandForeground70,
          ),
        ),
      ),
    );
  }
}
