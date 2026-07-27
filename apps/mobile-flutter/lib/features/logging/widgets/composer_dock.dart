import 'package:flutter/material.dart';

import '../../../theme/nham_theme.dart';
import '../logic/logging_spacing.dart';

/// The composer's floating dock: the feed scrolls UNDER it, so the day stays
/// visible behind the input instead of being cut off by a solid bar.
///
/// The dock paints nothing at all — the feed shows through it untouched, and
/// the only opaque thing here is the composer card inside, which floats on its
/// own shadow.
///
/// The dock reports its own height through [onHeightChanged] so the feed can
/// reserve exactly that much scroll padding; nothing is ever permanently
/// hidden behind it.
class ComposerDock extends StatefulWidget {
  const ComposerDock({
    super.key,
    required this.child,
    required this.onHeightChanged,
  });

  final Widget child;

  /// Fired (post-frame) whenever the dock's laid-out height changes — the
  /// composer grows with multiline text and with cheat mode's extra controls.
  final ValueChanged<double> onHeightChanged;

  @override
  State<ComposerDock> createState() => _ComposerDockState();
}

class _ComposerDockState extends State<ComposerDock> {
  final GlobalKey _dockKey = GlobalKey();
  double _reportedHeight = 0;

  void _reportHeight() {
    if (!mounted) return;
    final box = _dockKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;
    final height = box.size.height;
    // Sub-pixel churn would ping-pong the parent's setState forever.
    if ((height - _reportedHeight).abs() < 0.5) return;
    _reportedHeight = height;
    widget.onHeightChanged(height);
  }

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) => _reportHeight());
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Padding(
      key: _dockKey,
      padding: EdgeInsets.fromLTRB(
        NhamSpacing.sp3,
        LoggingSpacing.block,
        NhamSpacing.sp3,
        bottomInset + LoggingSpacing.block,
      ),
      child: widget.child,
    );
  }
}
