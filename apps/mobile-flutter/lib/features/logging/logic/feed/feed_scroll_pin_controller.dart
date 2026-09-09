/// The feed's tail-following state machine, with no widget around it.
library;

import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../../../theme/kallo_motion.dart';

/// Carries the newest turn to the top of the screen when the feed asks, and
/// then GETS OUT OF THE WAY. One deliberate travel per request, plus
/// corrections while the layout under it is still moving — the keyboard's
/// ~250ms inset ramp and the dock re-measuring behind it both change
/// `maxScrollExtent` after the target was computed. Corrections JUMP:
/// `animateTo` cancels what is in flight and restarts from the current pixel,
/// so re-aiming every frame never landed — the stutter. The pin then RELEASES
/// itself, and only an explicit [pin] arms it again: always-armed, it followed
/// the streaming card as it grew and, still armed a session later, threw the
/// feed down whenever the keyboard opened.
///
/// A plain object rather than a `State`: everything here is timers, flags and
/// scroll arithmetic, and none of it wants a build method. `FeedScrollPin`
/// owns one of these and feeds it the three scroll notifications.
class FeedScrollPinController {
  FeedScrollPinController(this.scroll);

  /// The scroll view being pinned. Settable because `FeedScrollPin` takes its
  /// controller as a widget property, which a rebuild may swap; the pin then
  /// aims at the new one rather than at a controller nothing owns.
  ScrollController scroll;

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

  /// Set by [dispose]. The aim loop hops frames, so it has to be able to ask
  /// whether the feed it was aiming at is still there.
  bool _disposed = false;

  /// Arm the pin and ride the tail — the feed asking for the newest turn.
  void pin() {
    _pinned = true;
    _release?.cancel();
    _release = Timer(_travel + _settle, release);
    _aim(animate: true);
  }

  /// Let the tail go. The user taking over, and the settle window expiring,
  /// both land here.
  void release() {
    _release?.cancel();
    _release = null;
    _pinned = false;
  }

  /// The layout under an armed pin moved — close the gap without animating.
  void correct() {
    if (_pinned) _aim(animate: false);
  }

  void dispose() {
    _release?.cancel();
    _disposed = true;
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
      if (_disposed || !_pinned) return;
      if (_travelling) return _aim(animate: animate);
      final controller = scroll;
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
        if (!_disposed && _pinned) {
          _release = Timer(queued ? _travel + _settle : _settle, release);
        }
      }
      // A lazy list grows under the travel, so one correction closes the gap —
      // unless a pin arrived mid-travel, which gets a travel of its own.
      _pendingTravel = false;
      _aim(animate: queued);
    });
  }
}
