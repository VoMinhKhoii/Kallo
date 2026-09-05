import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';

/// A quiet meta label on a full 44pt tap target — "Skip", "Stay on Free",
/// "Restore purchases", "I already have an account", "Change".
///
/// The label is meta-sized on purpose and the tap area must NOT follow it down
/// to the height of 14pt type, so the label pads out to the app's
/// [KalloIcons.hit] target. `widthFactor: 1` on the [Center] is load-bearing
/// the other way: without it the 44pt box claims the whole width it is offered
/// and swallows its neighbour's tap (the header's back chevron, the row's own
/// label).
///
/// It sits in `typography/` rather than beside its cousins in `form/` only
/// because that folder is at the structure gate's 10-entry cap; a meta-tier
/// label is a text affordance either way.
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
