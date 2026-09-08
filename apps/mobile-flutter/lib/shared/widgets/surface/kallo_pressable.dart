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
///
/// **Nesting (2026-09-08).** A pressable inside another pressable washes
/// ALONE: the innermost one under the finger takes the wash and every ancestor
/// stays clear. A Circle post is the tap target for its own thread (Threads
/// anatomy) while its heart, reply and copy glyphs are targets of their own, so
/// without this rule a tap on the heart flashed the whole post behind it.
///
/// Tap DISPATCH needs nothing here: both [GestureDetector]s enter the arena and
/// the innermost is first in the hit-test path, so it wins the sweep. Only the
/// wash needed teaching, because it is read off the raw pointer stream, which
/// has no arena and hands the event to every [Listener] on that path.
///
/// The mechanism is a [_PressScope] [InheritedWidget]: on pointer-down the
/// inner target CLAIMS its pointer up the chain of scopes before washing, and a
/// target whose own pointer is already claimed skips its wash. That ordering
/// works because Flutter dispatches a pointer to the hit-test path INNERMOST
/// FIRST — `RenderBox.hitTest` adds its children to the path before itself, and
/// `GestureBinding.dispatchEvent` walks that path in order. Verified by test
/// ("a nested pressable washes alone"), which would fail the other way round:
/// on a parent-first delivery the outer would have washed before the claim
/// arrived, and the claim would have had to un-press it instead.
///
/// Known limit: the wash stays on while a SCROLL begins on a pressed post —
/// the pointer never lifts, so nothing clears it until the gesture ends.
/// Clearing on an `onPointerMove` past `kTouchSlop` is the follow-up.
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

/// How a nested [KalloPressable] tells the ones above it that a pointer is
/// already spoken for. Exposed by every pressable over its own subtree, so a
/// claim walks the whole chain rather than only one level (see *Nesting*).
class _PressScope extends InheritedWidget {
  const _PressScope({required this.claim, required super.child});

  /// "This pointer belongs to a target below you — do not wash for it."
  final void Function(int pointer) claim;

  static _PressScope? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<_PressScope>();

  @override
  bool updateShouldNotify(_PressScope oldWidget) => oldWidget.claim != claim;
}

class _KalloPressableState extends State<KalloPressable> {
  bool _pressed = false;

  /// The scope of the nearest pressable ABOVE this one — the widget's own
  /// scope is a descendant, so this never resolves to itself.
  _PressScope? _parent;

  /// Pointers a target below this one has claimed, and which this one must
  /// therefore ignore. A Set rather than a single id because a second finger
  /// may land elsewhere in the same subtree.
  final Set<int> _claimed = <int>{};

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _parent = _PressScope.maybeOf(context);
  }

  void _claim(int pointer) {
    _claimed.add(pointer);
    // Forward, so an ancestor two levels up stays clear as well.
    _parent?.claim(pointer);
  }

  void _release(int pointer) {
    _claimed.remove(pointer);
    _setPressed(false);
  }

  void _down(PointerDownEvent event) {
    // Claim BEFORE washing: this callback runs before every ancestor's (the
    // hit-test path is innermost-first), so the ancestors read the claim when
    // their own turn comes.
    _parent?.claim(event.pointer);
    if (_claimed.contains(event.pointer)) return;
    _setPressed(true);
  }

  void _setPressed(bool value) {
    if (!mounted || _pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;
    return _PressScope(
      claim: _claim,
      child: Listener(
        // A disabled target neither washes nor claims: it is not a target, so
        // the post underneath it is still allowed to take the press.
        onPointerDown: enabled ? _down : null,
        onPointerUp: (event) => _release(event.pointer),
        onPointerCancel: (event) => _release(event.pointer),
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
      ),
    );
  }
}
