import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_motion.dart';
import 'press_scope.dart';

/// A tap target that washes while the finger is down and fires on release —
/// the platform's own press, and the one the design system prescribes in
/// place of Material's ripple (`mobile.md`, *Platform — Cupertino wherever it
/// exists*).
///
/// The pressed state is read off the raw pointer stream through a [Listener],
/// OUTSIDE the gesture arena, so no arena resolution can cancel the wash
/// mid-hold — a tap recognizer that loses the arena, to a long press at ~500ms
/// or to a scroll, would drop it with the finger still down.
///
/// Behaviour: a drag-off releases the wash (the pointer lifts somewhere) and
/// fires nothing (the tap recognizer sees the pointer leave). A null [onTap]
/// disables the target: no wash, no tap — and the tap goes nowhere else: a
/// disabled glyph inside a tappable post absorbs the press rather than handing
/// it to the post. Dimming a disabled target is the caller's, since it owns
/// the colours.
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
/// **Nesting (2026-09-08).** A pressable inside another pressable washes
/// ALONE, and a DISABLED one still owns its pointer: it enters the arena with
/// an inert tap callback and claims its pointer up the chain, so nothing above
/// it washes or fires. A disabled control is still a control — iOS never lets
/// a dimmed button's tap fall through to what is behind it. The Circle heart
/// is the case: [FeedEntryActions] passes `onTap: null` while its reaction
/// request is in flight, inside a post that opens the thread, so with the
/// press falling through a double tap on the heart navigated away
/// mid-reaction. [PressScope] and [PressClaims] hold the protocol and the
/// reasoning behind it.
///
/// **Scrolling (2026-09-08).** A pointer that travels more than `kTouchSlop`
/// from where it landed ends the wash, finger still down: past that distance
/// it is a scroll, not a press. Nothing else would clear it — the pointer
/// does not lift until the drag is over — so a flick down the Circle feed
/// left the post it started on grey for the whole gesture ("the feed flashes
/// grey when you scroll"). The pointer keeps its CLAIM, so no ancestor lights
/// up in its place, and the tap fires nothing: the recognizer loses the arena
/// to the scrollable at the same slop.
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

  /// This target's side of the nesting protocol — who has claimed what, and
  /// which finger the wash belongs to. It decides; this widget paints.
  final PressClaims _claims = PressClaims();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _claims.parent = PressScope.maybeOf(context);
  }

  void _down(PointerDownEvent event) {
    if (_claims.press(
      event.pointer,
      event.position,
      enabled: widget.onTap != null,
    )) {
      _setPressed(true);
    }
  }

  void _move(PointerMoveEvent event) {
    if (_claims.moved(event.pointer, event.position)) _setPressed(false);
  }

  void _release(int pointer) {
    if (_claims.release(pointer)) _setPressed(false);
  }

  /// The tap callback a DISABLED target wears. Non-null on purpose: a
  /// [GestureDetector] whose callbacks are all null registers no recognizer at
  /// all, so the target never enters the arena and the tap falls through to
  /// whatever is underneath it.
  static void _inert() {}

  void _setPressed(bool value) {
    if (!mounted || _pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    return PressScope(
      claim: _claims.claim,
      child: Listener(
        // Always wired, disabled or not: a disabled control is still a
        // control, so it takes its pointer out of circulation (claiming up the
        // chain) instead of leaving it to the target underneath. [_down]
        // decides for itself whether to wash.
        onPointerDown: _down,
        // The scroll release (see *Scrolling* above): a pointer up never
        // arrives while the finger is dragging the feed.
        onPointerMove: _move,
        onPointerUp: (event) => _release(event.pointer),
        onPointerCancel: (event) => _release(event.pointer),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          // [_inert] rather than null, so a disabled target still enters the
          // arena and swallows the tap it is sitting on.
          onTap: widget.onTap ?? _inert,
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
