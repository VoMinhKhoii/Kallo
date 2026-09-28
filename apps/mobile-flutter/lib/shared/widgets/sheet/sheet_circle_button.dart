import 'package:flutter/cupertino.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// A sheet's close or back control: a 36pt grey circle around an 18pt glyph,
/// the iOS 26 sheet button.
///
/// The circle is the visual; the tap target is the app's 44pt minimum and
/// extends from the circle's LEADING edge, so the circle itself starts on the
/// sheet's content line (see `KalloSheetHeader`). A [CupertinoButton] owns
/// the press: the platform's opacity fade, no Material ripple.
class SheetCircleButton extends StatelessWidget {
  const SheetCircleButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  /// The circle's diameter. With a 16pt inset its centre sits 34pt in from
  /// the sheet's corner, which is why [kSheetRadius] is 34.
  static const double size = 36;

  final IconData icon;

  /// Spoken name ("Close", "Back").
  final String label;

  /// Null renders the control dimmed and inert (a sheet mid-save).
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: CupertinoButton(
        onPressed: onTap,
        padding: EdgeInsets.zero,
        minimumSize: const Size.square(KalloIcons.hit),
        alignment: AlignmentDirectional.centerStart,
        child: SizedBox(
          width: KalloIcons.hit,
          height: KalloIcons.hit,
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: Container(
              width: size,
              height: size,
              decoration: const BoxDecoration(
                color: kTrack,
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: KalloIcons.tertiary,
                color: onTap == null ? KalloColors.textMuted : kInk,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
