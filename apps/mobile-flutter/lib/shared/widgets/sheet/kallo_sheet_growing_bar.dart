import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import 'sheet_circle_button.dart';

/// The sheet header's row without a trailing action: the leading control, and
/// the title centred between it and a mirror of it. It grows with its title,
/// which an inline rename field makes taller than the 44pt row; the controls
/// stay pinned to the row's top.
///
/// The subtitle sits BELOW that row, never inside it. Centred as one block
/// with the title, a long meal name pulled the title off the close button's
/// line and up into the grabber. Below the row it can use the full width, and
/// two lines keep a long meal from taking the sheet's list away.
class KalloSheetGrowingBar extends StatelessWidget {
  const KalloSheetGrowingBar({
    super.key,
    required this.leading,
    required this.heading,
    required this.subtitle,
  });

  final Widget leading;
  final Widget? heading;
  final String? subtitle;

  /// How far a 44pt tap target reaches past the 36pt circle on each side.
  static const double targetOverhang =
      (KalloIcons.hit - SheetCircleButton.size) / 2;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: KalloIcons.hit,
              height: KalloIcons.hit,
              child: leading,
            ),
            Expanded(
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: KalloIcons.hit),
                child: Align(child: heading),
              ),
            ),
            const SizedBox(width: KalloIcons.hit),
          ],
        ),
        if (subtitle != null)
          // Up by the control's invisible tap margin: the text starts where
          // the circle ends, close enough to read as the title's caption.
          Transform.translate(
            offset: const Offset(0, -targetOverhang),
            child: Text(
              subtitle!,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: dashMeta(),
            ),
          ),
      ],
    );
  }
}
