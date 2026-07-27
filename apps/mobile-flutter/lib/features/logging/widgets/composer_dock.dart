import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../logic/logging_spacing.dart';

/// The composer's floating dock: the feed scrolls UNDER it, so the day stays
/// visible behind the input instead of being cut off by a solid bar.
///
/// The dock itself is a blurred veil — content reads through it, softened —
/// while the composer card inside stays fully opaque. Two layers, deliberately:
/// the veil is what floats, the card is what you type into.
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

    return ClipRect(
      key: _dockKey,
      // The clip bounds the filter: without it the blur samples the whole
      // layer, not just the strip behind the dock.
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
        child: Container(
          // A veil, not a fill — enough to keep the composer legible over a
          // busy feed while the cards behind stay readable as cards.
          color: NhamColors.surface.withValues(alpha: 0.55),
          padding: EdgeInsets.fromLTRB(
            NhamSpacing.sp3,
            LoggingSpacing.block,
            NhamSpacing.sp3,
            bottomInset + LoggingSpacing.block,
          ),
          child: widget.child,
        ),
      ),
    );
  }
}
