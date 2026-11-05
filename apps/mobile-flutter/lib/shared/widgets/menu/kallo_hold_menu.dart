import 'package:flutter/widgets.dart';

import 'kallo_anchored_menu.dart';

/// How far a held item grows as its menu opens.
const double kKalloHoldLift = 1.05;

/// Press and hold [child] for a menu of [actions]: the app's ONE long-press
/// menu, so a sent message and a meal card answer the hold the same way
/// (owner, 2026-11-05).
///
/// Nothing moves while the finger waits. At Material's 500ms hold, in the
/// same frame, the haptic lands, the item lifts to [kKalloHoldLift] and the
/// card arrives beside it, all on the menu's 200ms curve with no overshoot;
/// they leave together the same way. A grow that ran across the whole hold
/// (2026-11-04) put the wait on screen and made the press read as slow, and
/// the meal cards' `CupertinoContextMenu` waited 800ms and then sprang open
/// on `easeOutBack` — both constants private to the SDK.
///
/// Taps still reach [child]: a press shorter than the hold resolves to the
/// child's own gesture.
class KalloHoldMenu<T> extends StatelessWidget {
  const KalloHoldMenu({
    super.key,
    required this.child,
    required this.actions,
    required this.onSelected,
    this.header,
    this.pinned,
  });

  final Widget child;
  final List<KalloMenuAction<T>> actions;

  /// Runs once the menu has closed, with what was picked.
  final ValueChanged<T> onSelected;

  /// One muted line above the rows — when a message was sent.
  final String? header;

  /// The copy lifted over the blur, when [child] would not draw the same
  /// thing outside the page (the sent bubble wraps by the page's width).
  final Widget? pinned;

  Future<void> _open(BuildContext context) async {
    // The detector's box is exactly the child's: the rect the item lifts from.
    final box = context.findRenderObject() as RenderBox?;
    final overlay =
        Overlay.of(context, rootOverlay: true).context.findRenderObject()
            as RenderBox?;
    if (box == null || !box.hasSize || overlay == null) return;
    final picked = await showKalloAnchoredMenu<T>(
      context,
      anchor: box.localToGlobal(Offset.zero, ancestor: overlay) & box.size,
      header: header,
      pinned: pinned ?? child,
      lift: kKalloHoldLift,
      actions: actions,
    );
    if (picked == null || !context.mounted) return;
    // A frame after the pop: pushing a sheet or a confirm in the SAME frame
    // the menu's route starts closing trips a framework semantics assertion
    // (`computeChildGeometry`; reproduced by the meal cards' hold tests).
    await WidgetsBinding.instance.endOfFrame;
    if (context.mounted) onSelected(picked);
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
    // Opaque: the whole item answers the hold, not just what is painted under
    // the finger.
    behavior: HitTestBehavior.opaque,
    onLongPress: () => _open(context),
    child: child,
  );
}
