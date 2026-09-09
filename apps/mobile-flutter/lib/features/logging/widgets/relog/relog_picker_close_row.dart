import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/kallo_colors.dart';
import '../../logic/logging_spacing.dart';

/// The close affordance, alone on its row; the `/` you just typed is the title.
/// NOT optional chrome — a phone keyboard has no Escape, and the picker is an
/// inline sibling in the dock, not an overlay: no barrier, no `PopScope`,
/// nothing closes on a tap outside. The one other caller of
/// `SlashPickerState.dismiss` is `RelogPickerCollapsed`, which nobody can tap.
class RelogPickerCloseRow extends StatelessWidget {
  const RelogPickerCloseRow({super.key, required this.onDismiss});

  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Semantics(
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
      ),
    );
  }
}
