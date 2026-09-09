import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import '../../logic/feed/feed_scroll_pin_controller.dart';

/// Imperative handle for [FeedScrollPin] — the feed asks the tail to follow.
/// Held by `FeedArea` and handed to the three places that put something new at
/// the bottom of the day: a submitted analysis, a staged relog, and a staged
/// cheat repeat. Nothing else scrolls the feed.
class FeedScrollPinHandle {
  FeedScrollPinController? _pin;

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
    _pin?.pin();
  }
}

/// The three scroll notifications a pinned feed answers, wired to the state
/// machine that answers them — [FeedScrollPinController], which owns the
/// timers, the travel and the release.
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
  late final FeedScrollPinController _pin = FeedScrollPinController(
    widget.controller,
  );

  @override
  void initState() {
    super.initState();
    widget.handle._pin = _pin;
  }

  @override
  void didUpdateWidget(FeedScrollPin old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller) _pin.scroll = widget.controller;
    if (old.handle != widget.handle) {
      if (old.handle._pin == _pin) old.handle._pin = null;
      widget.handle._pin = _pin;
    }
  }

  @override
  void dispose() {
    _pin.dispose();
    if (widget.handle._pin == _pin) widget.handle._pin = null;
    super.dispose();
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
            _pin.release();
          }
          return false;
        },
        child: NotificationListener<ScrollMetricsNotification>(
          onNotification: (n) {
            if (n.depth == 0) _pin.correct();
            return false;
          },
          child: widget.child,
        ),
      ),
    );
  }
}
