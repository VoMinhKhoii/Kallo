import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../../../theme/kallo_motion.dart';

/// Imperative handle for [FeedScrollPin] — the feed asks the tail to follow.
///
/// Held by `FeedArea` and handed to the three places that put something new at
/// the bottom of the day: a submitted analysis, a staged relog, and a staged
/// cheat repeat. Nothing else scrolls the feed.
class FeedScrollPinHandle {
  _FeedScrollPinState? _state;

  /// The day whose feed holds a viewport of room after its last item, so that
  /// riding to the bottom lands the newest turn at the TOP of the screen
  /// rather than flush against the composer. Null until the first send. It
  /// belongs to the handle because it is the same request the pin is: "put the
  /// tail where it can be read". Without it `maxScrollExtent` has nowhere to go
  /// on a short day and a send appears to do nothing.
  ///
  /// A DATE rather than a flag, because the room belongs to the day it was
  /// asked for: paging elsewhere must not leave an old day's last meal above a
  /// screen of nothing, and paging back should find the room where it was.
  ///
  /// Owned by `FeedArea`, which outlives every list that reads it, so nothing
  /// disposes this — `ValueListenableBuilder` drops its own listener.
  final ValueNotifier<String?> tailRoomFor = ValueNotifier<String?>(null);

  /// Ride the bottom of [date]'s list, opening the tail room so that the
  /// bottom IS the top of the newest turn.
  void pinToBottom(String date) {
    tailRoomFor.value = date;
    _state?._pin();
  }
}

/// Carries the newest turn to the top of the screen when the feed asks, and
/// then GETS OUT OF THE WAY.
///
/// One deliberate travel per request, plus corrections while the layout under
/// it is still moving — the keyboard's ~250ms inset ramp and the dock
/// re-measuring behind it both change `maxScrollExtent` after the target was
/// computed. Corrections JUMP: `animateTo` cancels what is in flight and
/// restarts from the current pixel, so re-aiming every frame produced a scroll
/// that never landed — the stutter.
///
/// The pin then RELEASES itself, and only an explicit
/// [FeedScrollPinHandle.pinToBottom] arms it again. Both halves are
/// load-bearing: an always-armed pin followed the streaming card as it grew,
/// dragging the just-sent message off the top — and it stayed armed for the
/// rest of the session, so merely opening the keyboard (which grows the feed's
/// reserved padding, and with it the extent) threw the feed to the bottom.
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
  static const Curve _travelCurve = KalloEase.decelerate;

  /// How long corrections keep following a request. Long enough to cover the
  /// keyboard's retract and the dock's re-measure behind it; short enough that
  /// the answer arriving a second later is never chased.
  static const Duration _settle = Duration(milliseconds: 1200);

  static const double _epsilon = 1; // sub-pixel drift is not worth a scroll

  bool _pinned = false;

  /// True while the deliberate travel runs — corrections stay out of its way.
  bool _travelling = false;

  Timer? _release;

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
    _release = Timer(_settle, _unpin);
    _aim(animate: true);
  }

  void _unpin() {
    _release?.cancel();
    _release = null;
    _pinned = false;
  }

  /// Move to the tail: the first move ANIMATES, every correction after it JUMPS.
  ///
  /// Always deferred: [ScrollMetricsNotification] fires DURING layout, and the
  /// tail room opens in the very frame a request arrives, so neither the extent
  /// to aim at nor a safe moment to scroll exists yet.
  ///
  /// Riding the bottom IS putting the newest turn at the top: the tail room
  /// makes `maxScrollExtent` that turn's own top offset for anything shorter
  /// than a viewport — `feed_tail_room.dart` carries the arithmetic.
  void _aim({required bool animate}) {
    if (_travelling) return;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted || !_pinned || _travelling) return;
      final controller = widget.controller;
      if (!controller.hasClients) return;
      final position = controller.position;
      final target = position.maxScrollExtent;
      if ((target - position.pixels).abs() <= _epsilon) return;
      if (!animate) return position.jumpTo(target);
      _travelling = true;
      try {
        await controller.animateTo(
          target,
          duration: _travel,
          curve: _travelCurve,
        );
      } finally {
        _travelling = false;
      }
      // A lazy list builds more of itself on the way down, so the extent can
      // have moved under the travel. One correction closes that gap.
      _aim(animate: false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return NotificationListener<ScrollStartNotification>(
      // Drag-to-dismiss the keyboard, for every feed scroll view. `onDrag` on
      // the ListView alone is not enough: it needs a ScrollUpdateNotification
      // carrying dragDetails, which never arrives when the drag is pure
      // overscroll (dragging DOWN from the top clamps, so pixels never move and
      // only an OverscrollNotification fires). A drag START always fires.
      //
      // It lives here rather than in the list because it answers the same
      // question the pin does — "did the user take over?" — and the two must
      // not disagree about it.
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
