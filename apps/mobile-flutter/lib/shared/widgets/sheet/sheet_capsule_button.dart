import 'package:flutter/cupertino.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import 'sheet_circle_button.dart';

/// A sheet header's text action ("Edit", "Done", "Enter manually"): a grey
/// capsule the height of [SheetCircleButton], so both header controls share
/// one line and one curve with the sheet's corner.
///
/// The capsule's TRAILING edge sits on the content line; the 44pt target
/// grows inward and vertically around it, never pushing it off that line.
class SheetCapsuleButton extends StatelessWidget {
  const SheetCapsuleButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
  });

  final String label;

  /// A leading glyph, for an action a word alone undersells (the pencil on
  /// "Enter manually").
  final IconData? icon;

  /// Null renders the capsule dimmed and inert.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = onTap == null ? KalloColors.textMuted : kInk;
    return CupertinoButton(
      onPressed: onTap,
      padding: EdgeInsets.zero,
      minimumSize: const Size.square(KalloIcons.hit),
      child: SizedBox(
        height: KalloIcons.hit,
        child: Align(
          alignment: AlignmentDirectional.centerEnd,
          widthFactor: 1,
          child: Container(
            height: SheetCircleButton.size,
            padding: EdgeInsetsDirectional.only(
              start: icon == null ? KalloSpacing.sp4 : KalloSpacing.sp3,
              end: KalloSpacing.sp4,
            ),
            decoration: const ShapeDecoration(
              color: kTrack,
              shape: StadiumBorder(),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 16, color: color),
                  const SizedBox(width: 6),
                ],
                Text(label, style: kButtonLabel(color: color)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
