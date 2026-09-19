import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_shapes.dart';

/// A top-toast's tone — sets the leading icon + its color.
enum TopToastVariant { success, error }

/// The toast's visual: a white pill, a status glyph, the message, and an
/// optional action label. Purely presentational — the entry/exit animation,
/// the hold timer and the overlay plumbing live in `top_toast.dart`.
class TopToastPill extends StatelessWidget {
  const TopToastPill({
    super.key,
    required this.message,
    required this.variant,
    this.actionLabel,
    this.onAction,
  });

  final String message;
  final TopToastVariant variant;
  final String? actionLabel;
  final VoidCallback? onAction;

  bool get _hasAction => actionLabel != null;

  @override
  Widget build(BuildContext context) {
    // The toast is shown in the ROOT overlay, which sits above every Material
    // in the app. Text with no Material ancestor inherits Flutter's fallback
    // style — whose debugLabel is literally "consider putting your text in a
    // Material" — and that style carries a yellow double underline. `dashBody`
    // merges onto it (TextStyle.inherit defaults to true) and overrides colour,
    // size and family but never `decoration`, so the underline survived and
    // painted yellow under the message. A transparent Material installs a real
    // DefaultTextStyle and adds no pixels of its own.
    return Material(
      type: MaterialType.transparency,
      child: Container(
        margin: const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp3,
          vertical: KalloSpacing.sp2,
        ),
        // 16 horizontal / 12 vertical — the same optical card inset the rest of
        // the app uses; the action side gives back half so the tappable label
        // sits on the pill's edge without the row reading lopsided.
        padding: EdgeInsets.fromLTRB(
          KalloSpacing.sp4,
          KalloSpacing.sp3,
          _hasAction ? KalloSpacing.sp2 : KalloSpacing.sp4,
          KalloSpacing.sp3,
        ),
        // A real squircle now, not a rounded rect. The comment here always
        // said "squircle"; `BorderRadius.circular` could not draw one.
        //
        // The toast is a floating SURFACE, and the app gives surfaces a
        // squircle (card 22, container 16) while the pill is reserved for
        // buttons. `card` would not read as one here: the toast stands ~45pt
        // tall, so 22 is half its height and renders as a stadium anyway. 18
        // is the first step down that keeps a visible flat edge.
        decoration: ShapeDecoration(
          // Solid white, not the retired cream — #FFFCF8 read yellow against
          // the neutral canvas.
          color: kCardSurface,
          shape: KalloShapes.squircle(
            KalloRadii.xxl,
            side: const BorderSide(color: kHairline),
          ),
          shadows: kCardShadows,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              variant == TopToastVariant.error
                  ? LucideIcons.circleAlert300
                  : LucideIcons.check300,
              // Status colour rides the icon, never the copy.
              size: 16,
              color:
                  variant == TopToastVariant.error ? KalloColors.danger : kInk,
            ),
            const SizedBox(width: KalloSpacing.sp2),
            Flexible(
              child: Text(
                message,
                textAlign: _hasAction ? TextAlign.left : TextAlign.center,
                style: dashBody(),
              ),
            ),
            if (_hasAction) ...[
              const SizedBox(width: KalloSpacing.sp2),
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onAction,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: KalloSpacing.sp2,
                    vertical: KalloSpacing.sp1,
                  ),
                  // Regular, like every button label: Be Vietnam Pro's
                  // Medium already reads semibold.
                  child: Text(actionLabel!, style: dashBody()),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
