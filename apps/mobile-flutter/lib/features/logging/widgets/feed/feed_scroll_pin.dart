import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../../../theme/kallo_motion.dart';

/// Imperative handle for [FeedScrollPin] — the feed asks the tail to follow.
///
/// Held by `FeedArea` and handed to the three places that put something new at
/// the bottom of the day: a submitted analysis, a staged relog, and a staged
/// cheat repeat.
class FeedScrollPinHandle {
  _FeedScrollPinState? _state;

  /// The day whose feed holds a viewport of room after its last item, so that
  /// riding to the bottom lands the newest turn at the TOP of the screen
  /// rather than flush against the composer. Null until the first send.
  ///
  /// It belongs to the handle rather than the list because it is the same
  /// request: "put the tail where the user can read it". Without the room,
  /// `maxScrollExtent` has nowhere to go on a short day and a send appears to
  /// do nothing — the feed only travelled later, when the keyboard's inset
  /// grew the extent and the still-armed pin re-aimed at it.
  ///
  /// A DATE rather than a flag, because the room belongs to the day the user
  /// sent on: paging elsewhere must not leave an old day's last meal above a
  /// screen of nothing, and paging back should find the room where it was. A
  /// bool needed an imperative reset on every day change to say the same
  /// thing, and said it worse.
  ///
  /// Owned by `FeedArea`, which outlives every list that reads it, so nothing
  /// disposes this — `ValueListenableBuilder` drops its own listener.
  final ValueNotifier<String?> tailRoomFor = ValueNotifier<String?>(null);

  /// Ride the bottom of [date]'s list until the user scrolls away from it,
  /// opening the tail room so the bottom IS the top of the newest turn.
  void pinToBottom(String date) {
    tailRoomFor.value = date;
    _state?._pin();
  }
}

/// Keeps the feed's tail in view while an answer arrives.
///
/// The naive version of this — one post-frame callback, then
/// `animateTo(maxScrollExtent)` — lands short, because on the frame after a
/// submit the extent it reads is already stale. Three things are still moving:
/// the streaming card has not been laid out at its final height, the keyboard's
/// viewport inset is animating over ~250ms, and the composer dock reports a new
/// height once the keyboard changes its safe-area inset, which re-pads the list.
/// Each of those changes `maxScrollExtent` AFTER the target was computed.
///
/// So this does not aim once. It sets a flag and re-aims every time the metrics
/// move, which is what makes the tail actually land at the bottom rather than
/// near it. The flag is the whole design: a user who scrolls up to re-read the
/// day must not be dragged back down, so any deliberate scroll away from the
/// tail releases the pin, and returning to the tail re-arms it.
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
  /// How close to the end still counts as "at the tail" when re-arming.
  static const double _tailSlack = 24;

  /// The deliberate travel when the feed asks for the tail — the feel the
  /// one-shot scroll had, kept.
  static const Duration _travel = KalloMotion.scrollTo;
  static const Curve _travelCurve = KalloEase.decelerate;

  /// The corrections afterwards. Short, because each one only closes the gap
  /// the last layout change opened; at 400ms they would visibly lag the card.
  static const Duration _follow = KalloMotion.instant;

  bool _pinned = false;

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
    if (widget.handle._state == this) widget.handle._state = null;
    super.dispose();
  }

  void _pin() {
    _pinned = true;
    _scroll(_travel, _travelCurve);
  }

  /// Always deferred: [ScrollMetricsNotification] fires DURING layout, and
  /// starting an animation there re-enters it.
  void _scroll(Duration duration, Curve curve) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_pinned) return;
      final controller = widget.controller;
      if (!controller.hasClients) return;
      final target = controller.position.maxScrollExtent;
      if ((target - controller.position.pixels).abs() <= 1) return;
      controller.animateTo(target, duration: duration, curve: curve);
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
          // Reading older cards releases the tail.
          if (n.depth == 0 && n.direction == ScrollDirection.forward) {
            _pinned = false;
          }
          return false;
        },
        child: NotificationListener<ScrollEndNotification>(
          onNotification: (n) {
            // Scrolled back to the tail under their own power — follow again.
            if (n.depth == 0) {
              _pinned =
                  n.metrics.pixels >= n.metrics.maxScrollExtent - _tailSlack;
            }
            return false;
          },
          child: NotificationListener<ScrollMetricsNotification>(
            onNotification: (n) {
              if (n.depth == 0 && _pinned) _scroll(_follow, KalloEase.press);
              return false;
            },
            child: widget.child,
          ),
        ),
      ),
    );
  }
}
