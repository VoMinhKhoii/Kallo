import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../../../theme/kallo_motion.dart';

/// Imperative handle for [FeedScrollPin] — the feed asks the tail to follow.
/// Held by `FeedArea` and handed to the three places that put something new at
/// the bottom of the day: a submitted analysis, a staged relog, and a staged
/// cheat repeat. Nothing else scrolls the feed.
class FeedScrollPinHandle {
  _FeedScrollPinState? _state;

  /// The day whose feed holds a viewport of room after its last item, so that
  /// riding to the bottom lands the newest turn at the TOP of the screen rather
  /// than flush against the composer. Null until the first send. It belongs to
  /// the handle because it is the same request the pin is — without it
  /// `maxScrollExtent` has nowhere to go on a short day and a send appears to
  /// do nothing. A DATE, not a flag: the room belongs to the day it was asked
  /// for. Owned by `FeedArea`, which outlives every list that reads it, so
  /// nothing disposes this — `ValueListenableBuilder` drops its own listener.
  final ValueNotifier<String?> tailRoomFor = ValueNotifier<String?>(null);

  /// Ride the bottom of [date]'s list, opening the tail room so that the
  /// bottom IS the top of the newest turn.
  void pinToBottom(String date) {
    tailRoomFor.value = date;
    _state?._pin();
  }
}

/// Carries the newest turn to the top of the screen when the feed asks, and
/// then GETS OUT OF THE WAY. One deliberate travel per request, plus
/// corrections while the layout under it is still moving — the keyboard's
/// ~250ms inset ramp and the dock re-measuring behind it both change
/// `maxScrollExtent` after the target was computed. Corrections JUMP:
/// `animateTo` cancels what is in flight and restarts from the current pixel,
/// so re-aiming every frame never landed — the stutter. The pin then RELEASES
/// itself, and only an explicit [FeedScrollPinHandle.pinToBottom] arms it
/// again: always-armed, it followed the streaming card as it grew and, still
/// armed a session later, threw the feed down whenever the keyboard opened.
class FeedScrollPin extends StatefulWidget {
  const FeedScrollPin({
    super.key,
    required this.handle,
    required this.controller,
    required this.child,
  });

  final FeedScrollPinHandle handle;
  final ScrollController controller;
  final Widget child;

  @override
  State<FeedScrollPin> createState() => _FeedScrollPinState();
}

class _FeedScrollPinState extends State<FeedScrollPin> {
  /// The deliberate travel when the feed asks for the tail.
  static const Duration _travel = KalloMotion.scrollTo;

  /// How long corrections follow a request once its travel has LANDED: the
  /// keyboard's ~250ms retract plus one dock re-measure. Armed as [_travel] +
  /// this while a travel is still to come (the first request, and any travel
  /// that queued another), and as this alone from a landing with nothing
  /// queued — armed bare across a queued travel, the pin let go ~50ms before
  /// that travel landed. At 1.2s the window also spanned a fast reveal,
  /// chasing the answer to the new bottom.
  static const Duration _settle = Duration(milliseconds: 350);
  static const double _epsilon = 1; // sub-pixel drift is not worth a scroll

  bool _pinned = false;
  Timer? _release;

  /// True while the deliberate travel runs — corrections stay out of its way.
  bool _travelling = false;

  bool _pendingTravel = false;

  @override
  void initState() {
    super.initState();
    widget.handle._state = this;
  }

  @override
  void didUpdateWidget(FeedScrollPin old) {
    super.didUpdateWidget(old);
    if (old.handle != widget.handle) {
      if (old.handle._state == this) old.handle._state = null;
      widget.handle._state = this;
    }
  }

  @override
  void dispose() {
    _release?.cancel();
    if (widget.handle._state == this) widget.handle._state = null;
    super.dispose();
  }

  void _pin() {
    _pinned = true;
    _release?.cancel();
    _release = Timer(_travel + _settle, _unpin);
    _aim(animate: true);
  }

  void _unpin() {
    _release?.cancel();
    _release = null;
    _pinned = false;
  }

  /// Move to the tail: a request ANIMATES, every correction after it JUMPS. A
  /// request arriving mid-travel is queued, not refused: the landing travel
  /// aimed at an extent that has since moved, and a jump to rescue that is the
  /// stutter. Always deferred — [ScrollMetricsNotification] fires DURING layout
  /// and the tail room opens in the frame a request arrives, so neither the
  /// extent nor a safe moment to scroll exists yet. Riding the bottom IS the
  /// newest turn at the top — `feed_tail_room.dart` carries the arithmetic.
  void _aim({required bool animate}) {
    if (_travelling) {
      _pendingTravel |= animate;
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted || !_pinned) return;
      if (_travelling) return _aim(animate: animate);
      final controller = widget.controller;
      if (!controller.hasClients) return;
      final position = controller.position;
      final target = position.maxScrollExtent;
      if ((target - position.pixels).abs() <= _epsilon) return;
      if (!animate) return position.jumpTo(target);
      _travelling = true;
      // Read BEFORE the window is armed: a queued travel has not started yet,
      // and the window has to outlast the landing of the travel it queued.
      var queued = false;
      try {
        await controller.animateTo(
          target,
          duration: _travel,
          curve: KalloEase.decelerate,
        );
      } finally {
        _travelling = false;
        queued = _pendingTravel;
        _release?.cancel(); // the window runs from the LANDING — see [_settle]
        if (mounted && _pinned) {
          _release = Timer(queued ? _travel + _settle : _settle, _unpin);
        }
      }
      // A lazy list grows under the travel, so one correction closes the gap —
      // unless a pin arrived mid-travel, which gets a travel of its own.
      _pendingTravel = false;
      _aim(animate: queued);
    });
  }

  @override
  Widget build(BuildContext context) {
    return NotificationListener<ScrollStartNotification>(
      // Drag-to-dismiss the keyboard, for every feed scroll view. `onDrag` on
      // the ListView alone is not enough: it needs a ScrollUpdateNotification
      // carrying dragDetails, which never arrives when the drag is pure
      // overscroll (dragging DOWN from the top clamps, so pixels never move and
      // only an OverscrollNotification fires). A drag START always fires. It
      // lives here rather than in the list because it answers the same question
      // the pin does — "did the user take over?" — and the two must not
      // disagree about it.
      onNotification: (n) {
        if (n.depth == 0 && n.dragDetails != null) {
          FocusManager.instance.primaryFocus?.unfocus();
        }
        return false;
      },
      child: NotificationListener<UserScrollNotification>(
        onNotification: (n) {
          // `forward` is a finger dragging down, i.e. moving back UP the day.
          // Reading older cards releases the tail — and it stays released:
          // re-arming on a settle near the bottom meant a later layout change
          // (the keyboard opening, most of all) dragged the user down again.
          if (n.depth == 0 && n.direction == ScrollDirection.forward) {
            _unpin();
          }
          return false;
        },
        child: NotificationListener<ScrollMetricsNotification>(
          onNotification: (n) {
            if (n.depth == 0 && _pinned) _aim(animate: false);
            return false;
          },
          child: widget.child,
        ),
      ),
    );
  }
}
