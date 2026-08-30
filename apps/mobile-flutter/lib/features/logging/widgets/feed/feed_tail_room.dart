import 'package:flutter/material.dart';

import 'feed_scroll_pin.dart';

/// The room the feed keeps after its last item so that riding to the bottom
/// lands the newest turn at the TOP of the screen — the travel every chat app
/// performs the moment you hit send.
///
/// Without it the list's only trailing padding is the composer dock, so
/// `maxScrollExtent` has nowhere to go on a short day: the sent message stops
/// flush above the composer and the send reads as having done nothing. The
/// feed then travelled at the wrong moment instead — when the keyboard's inset
/// shrank the viewport, grew the extent, and the still-armed pin re-aimed.
///
/// Give the last item a floor of one viewport less the dock the list already
/// pads for, and the extent works out to that item's own top offset:
///
/// ```text
///   maxScrollExtent = A + (viewport − dock) + dock − viewport  ==  A
/// ```
///
/// where `A` is everything above the last item. Both the dock height and the
/// viewport cancel, which is the rest of the fix: neither the keyboard nor the
/// dock re-measuring itself moves the feed any more. A turn taller than the
/// viewport ignores the floor and rides to the bottom exactly as before.
///
/// Hands [builder] the floor to apply — `0` while the room is closed.
class FeedTailRoom extends StatefulWidget {
  const FeedTailRoom({
    super.key,
    required this.pin,
    required this.dockHeight,
    required this.date,
    required this.builder,
  });

  /// The room opens when the pin is asked for the tail, and belongs to the
  /// handle for the same reason: both answer "put the tail where it can be
  /// read".
  final FeedScrollPinHandle pin;

  /// The floating composer's measured height — already the list's bottom
  /// padding, and subtracted here so the two do not stack.
  final double dockHeight;

  /// The day on screen. Paging to another one is a fresh read, not a
  /// continuation of the turn that opened the room.
  final String date;

  final Widget Function(BuildContext context, double tailRoom) builder;

  @override
  State<FeedTailRoom> createState() => _FeedTailRoomState();
}

class _FeedTailRoomState extends State<FeedTailRoom> {
  /// Mirrors [FeedScrollPinHandle.tailRoomOpen]. Held locally so a day change
  /// can close the room and have it gone in the SAME build, rather than a
  /// frame later with a screen of blank space on show.
  bool _open = false;

  @override
  void initState() {
    super.initState();
    _open = widget.pin.tailRoomOpen.value;
    widget.pin.tailRoomOpen.addListener(_sync);
  }

  @override
  void didUpdateWidget(FeedTailRoom old) {
    super.didUpdateWidget(old);
    if (old.pin != widget.pin) {
      old.pin.tailRoomOpen.removeListener(_sync);
      widget.pin.tailRoomOpen.addListener(_sync);
      _open = widget.pin.tailRoomOpen.value;
    }
    // `_open` is cleared alongside the notifier, so the listener below finds
    // nothing to change and never calls setState mid-build.
    if (old.date != widget.date && _open) {
      _open = false;
      widget.pin.closeTailRoom();
    }
  }

  void _sync() {
    if (mounted && _open != widget.pin.tailRoomOpen.value) {
      setState(() => _open = widget.pin.tailRoomOpen.value);
    }
  }

  @override
  void dispose() {
    widget.pin.tailRoomOpen.removeListener(_sync);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final room = constraints.maxHeight - widget.dockHeight;
      return widget.builder(context, _open && room > 0 ? room : 0.0);
    },
  );
}

/// Applies the floor [FeedTailRoom] computed to the feed's last item.
///
/// A `Column` rather than an `Align` so the item keeps the tight width a list
/// item is given, and sits at the top of the room rather than centred in it.
Widget withTailRoom(double room, Widget child) {
  if (room <= 0) return child;
  return ConstrainedBox(
    constraints: BoxConstraints(minHeight: room),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [child],
    ),
  );
}
