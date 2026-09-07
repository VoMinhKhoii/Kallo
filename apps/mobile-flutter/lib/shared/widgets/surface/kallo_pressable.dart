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
/// The wash is painted by an [AnimatedContainer] — every quiet control in the
/// app crossfades its wash over [KalloMotion.press] rather than snapping it.
class KalloPressable extends StatefulWidget {
  const KalloPressable({
    required this.onTap,
    required this.child,
    this.washColor = KalloColors.pressWash,
    this.borderRadius,
    this.height,
    this.constraints,
    this.padding,
    this.alignment,
    super.key,
  });

  /// Null disables the target.
  final VoidCallback? onTap;
  final Widget child;

  /// What paints while pressed. Ink at 6% by default — the app's press token.
  final Color washColor;

  /// Rounds the wash; leave null for a full-bleed row (the alert action).
  final BorderRadius? borderRadius;

  // Box geometry, passed straight to the container so a consumer sizes its
  // tap target here and nowhere else.
  final double? height;
  final BoxConstraints? constraints;
  final EdgeInsetsGeometry? padding;
  final AlignmentGeometry? alignment;

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
          alignment: widget.alignment,
          decoration: BoxDecoration(
            color: _pressed ? widget.washColor : const Color(0x00000000),
            borderRadius: widget.borderRadius,
          ),
          child: widget.child,
        ),
      ),
    );
  }
}
