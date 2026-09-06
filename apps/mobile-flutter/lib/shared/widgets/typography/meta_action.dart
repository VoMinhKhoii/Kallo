import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';

/// A quiet meta label on a full 44pt tap target — "Skip", "Stay on Free",
/// "Restore purchases", "I already have an account", "Change".
///
/// The label is meta-sized but the tap area must not follow it down to 14pt
/// type, so it pads out to [KalloIcons.hit]. `widthFactor: 1` on the [Center]
/// is load-bearing the other way: without it the 44pt box claims every pixel
/// offered and swallows its neighbour's tap.
class MetaAction extends StatelessWidget {
  const MetaAction({
    super.key,
    required this.label,
    required this.onTap,
    this.color,
    this.padding = EdgeInsets.zero,
  });

  final String label;

  /// Null disables it: the semantics say so and the target stops taking taps.
  final VoidCallback? onTap;

  /// Defaults to [dashMeta]'s own muted ink.
  final Color? color;

  /// Inside the target, so the slack it buys is tappable too. Used where the
  /// label has to stand off an edge or off its neighbour.
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    enabled: onTap != null,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        height: KalloIcons.hit,
        child: Center(
          widthFactor: 1,
          child: Padding(
            padding: padding,
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: color == null ? dashMeta() : dashMeta(color: color!),
            ),
          ),
        ),
      ),
    ),
  );
}
