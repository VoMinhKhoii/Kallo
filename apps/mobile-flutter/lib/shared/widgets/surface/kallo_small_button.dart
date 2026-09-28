import 'package:flutter/cupertino.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// The two looks of a [KalloSmallButton].
enum KalloSmallButtonVariant {
  /// White with the app's hairline — every secondary action ("Sửa hồ sơ",
  /// "Xem nhóm"). Quiet enough to sit beside a name without competing.
  outline,

  /// Solid ink, white label — a RARE action that should stand out from the
  /// outlines around it ("Bỏ chặn"). Ink rather than a hue: the user tried
  /// pastels and brand blues and settled on black (2026-09-28).
  ink,
}

/// A small squircle button for an action that is NOT the surface's primary:
/// 34pt tall, the label at 14 on the button-label weight, corners drawn as
/// Apple's continuous superellipse ([RoundedSuperellipseBorder]) rather than a
/// circular arc — the shape iOS gives its own buttons.
///
/// It is the counterpart to [KalloButton]'s 50pt full-round pills, which stay
/// for primaries (a page's save, an empty state's one action). Two sizes of
/// one family: dominant = pill, secondary = this.
///
/// [CupertinoButton] owns the press (the platform's fade) and the 44pt hit
/// target; the 34pt shape sits centred inside it, so the button is smaller to
/// the eye than to the finger.
class KalloSmallButton extends StatelessWidget {
  const KalloSmallButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = KalloSmallButtonVariant.outline,
    this.expand = false,
  });

  final String label;

  /// Null disables it (dimmed by [CupertinoButton]).
  final VoidCallback? onPressed;
  final KalloSmallButtonVariant variant;

  /// Fill the width the parent offers — the Settings pair shares a row
  /// half and half. Otherwise the button hugs its label.
  final bool expand;

  /// The visible shape's height.
  static const double height = 34;

  /// Corner radius of the superellipse. 10 at 34pt tall is iOS's own
  /// proportion for a compact button: rounded, never a pill.
  static const double radius = 10;

  @override
  Widget build(BuildContext context) {
    final ink = variant == KalloSmallButtonVariant.ink;
    final shape = Container(
      height: height,
      width: expand ? double.infinity : null,
      padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3_5),
      decoration: ShapeDecoration(
        color: ink ? kInk : kCardSurface,
        shape: RoundedSuperellipseBorder(
          borderRadius: BorderRadius.circular(radius),
          side: ink ? BorderSide.none : const BorderSide(color: kHairline),
        ),
      ),
      // `widthFactor: 1` hugs the label; an expanded button centres it in
      // the width it was given.
      child: Center(
        widthFactor: expand ? null : 1,
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: kButtonLabel(size: 14, color: ink ? KalloColors.elev : kInk),
        ),
      ),
    );
    return CupertinoButton(
      minimumSize: const Size(KalloIcons.hit, KalloIcons.hit),
      padding: EdgeInsets.zero,
      onPressed: onPressed,
      child: shape,
    );
  }
}
