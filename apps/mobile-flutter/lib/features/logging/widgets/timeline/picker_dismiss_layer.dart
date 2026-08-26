import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Lays an outside-tap dismiss layer over [child] — the surface that collapses
/// the date picker when you tap anywhere off it.
///
/// The layer is ALWAYS mounted and always `Positioned.fill`; only its
/// hit-testing toggles with [expanded]. That is not tidiness, it is the fix for
/// a layout collapse:
///
/// A [Stack] sizes itself to its largest NON-positioned child, falling back to
/// `constraints.biggest` only when every child is positioned. This stack sits
/// inside a `Column` → `Expanded`, which gives it a TIGHT height but a LOOSE
/// width. So the moment a zero-sized non-positioned child appears among the
/// children — a `SizedBox.shrink()` returned by a builder for the collapsed
/// case, say — the stack's width snaps to 0 and takes the feed with it: the
/// composer's placeholder renders one character per line and the day looks
/// empty.
///
/// Keeping the [Positioned.fill] outside the builder makes that unreachable —
/// there is never a non-positioned child to size the stack — and it is why the
/// conditional lives on [IgnorePointer] rather than on the widget itself.
class PickerDismissLayer extends StatelessWidget {
  const PickerDismissLayer({
    super.key,
    required this.expanded,
    required this.onDismiss,
    required this.child,
  });

  /// Whether the picker is open, i.e. whether the layer should catch taps.
  final ValueListenable<bool> expanded;

  /// Called on a tap outside the picker.
  final VoidCallback onDismiss;

  /// The content beneath the layer — the day's feed.
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned.fill(child: child),
        Positioned.fill(
          child: ValueListenableBuilder<bool>(
            valueListenable: expanded,
            // Translucent, so while the picker is closed the feed below keeps
            // every tap and scroll it would have had.
            builder:
                (_, isExpanded, _) => IgnorePointer(
                  ignoring: !isExpanded,
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onTap: onDismiss,
                  ),
                ),
          ),
        ),
      ],
    );
  }
}
