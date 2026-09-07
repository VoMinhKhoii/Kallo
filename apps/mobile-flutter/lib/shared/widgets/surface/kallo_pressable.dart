import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_motion.dart';

/// A tap target that washes while the finger is down and fires on release —
/// the platform's own press, and the one the design system prescribes in
/// place of Material's ripple (`mobile.md`, *Platform — Cupertino wherever it
/// exists*).
///
/// The pressed state is read off the raw pointer stream through a [Listener],
/// OUTSIDE the gesture arena, so no arena resolution can cancel the wash
/// mid-hold. That is the whole reason this exists as a primitive: the app's
/// older press implementations drive `_pressed` from `onTapDown`/`onTapUp`/
/// `onTapCancel`, and a tap recognizer that loses the arena — to a long press
/// at ~500ms, to a scroll — fires `onTapCancel` and drops the wash with the
/// finger still down. The confirm dialog shipped exactly that bug
/// (2026-09-07). Two sites needed the corrected shape at once, which made it a
/// shared widget rather than a second copy.
///
/// Behaviour: a drag-off releases the wash (the pointer lifts somewhere) and
/// fires nothing (the tap recognizer sees the pointer leave). A null [onTap]
/// disables the target: no wash, no tap. Dimming a disabled target is the
/// caller's, since it owns the colours.
///
/// The wash is [KalloColors.pressWash], full-bleed — the app has one press
/// token and every consumer so far is a rectangular row or square. It is
/// painted by an [AnimatedContainer] so it crossfades over [KalloMotion.press]
/// like every other quiet control, rather than snapping.
///
/// **Sizing (2026-09-08).** The target SHRINK-WRAPS in both axes: it is as
/// wide and as tall as its child (plus [padding], within [constraints] and
/// [height]). A parent that wants the target wider hands it tight
/// constraints — a [Column] with [CrossAxisAlignment.stretch], a
/// [SizedBox.expand] — which is how [KalloAlertAction] is full-bleed.
///
/// That is why [alignment] is applied by an explicit [Align] with BOTH size
/// factors rather than by the container's own `alignment`: Container's is an
/// [Align] WITHOUT factors, which grows to any FINITE max width it is
/// offered. A [Row] offers its children unbounded width, so this shrink-wrapped
/// by accident; a [Wrap] offers the COLUMN width, so every [FeedActionButton]
/// in the Circle post action row became column-wide and each of the three
/// landed on its own line.
class KalloPressable extends StatefulWidget {
  const KalloPressable({
    required this.onTap,
    required this.child,
    this.height,
    this.constraints,
    this.padding,
    this.alignment = Alignment.center,
    super.key,
  });

  /// Null disables the target.
  final VoidCallback? onTap;
  final Widget child;

  // Box geometry, passed straight to the container so a consumer sizes its
  // tap target here and nowhere else.
  final double? height;
  final BoxConstraints? constraints;
  final EdgeInsetsGeometry? padding;

  /// Where the child sits in the target. Applied by an [Align] with both size
  /// factors, so aligning never widens the box (see *Sizing* above).
  final AlignmentGeometry alignment;

  @override
  State<KalloPressable> createState() => _KalloPressableState();
}

class _KalloPressableState extends State<KalloPressable> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (!mounted || _pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;
    return Listener(
      onPointerDown: enabled ? (_) => _setPressed(true) : null,
      onPointerUp: (_) => _setPressed(false),
      onPointerCancel: (_) => _setPressed(false),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: KalloMotion.press,
          curve: KalloEase.press,
          height: widget.height,
          constraints: widget.constraints,
          padding: widget.padding,
          color: _pressed ? KalloColors.pressWash : const Color(0x00000000),
          child: Align(
            alignment: widget.alignment,
            widthFactor: 1,
            heightFactor: 1,
            child: widget.child,
          ),
        ),
      ),
    );
  }
}
