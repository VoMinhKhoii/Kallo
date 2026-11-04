import 'package:flutter/gestures.dart' show kLongPressTimeout;
import 'package:flutter/widgets.dart';

import '../../../../theme/kallo_motion.dart';

/// The sent bubble's held-press grow (owner, 2026-11-04): the meal card's
/// lift on the bubble's own 500ms hold menu.
///
/// From the first touch the pill swells to [scale] about its right edge — a
/// sixth of the hold standing still first, as `CupertinoContextMenu` does, so
/// a scroll that starts on it never flickers — and lands there as the menu
/// opens. The menu's pinned copy is drawn through [wrap] too, so both copies
/// stay at that size while the menu is open and ease back together as it
/// closes. Lifting the finger early shrinks it back without opening anything.
///
/// Small, and grown IN PLACE: the owned menu exists because the system one
/// moved the bubble out from under the finger (`user_message_bubble.dart`).
class BubbleLift {
  BubbleLift({required TickerProvider vsync})
    : _hold = AnimationController(
        vsync: vsync,
        // Exactly the long-press timeout, so it is full size as the menu opens.
        duration: kLongPressTimeout,
        reverseDuration: KalloMotion.quick,
      );

  /// How far the bubble grows while held.
  static const double scale = 1.05;

  final AnimationController _hold;

  late final Animation<double> _scale = Tween<double>(
    begin: 1,
    end: scale,
  ).animate(
    CurvedAnimation(
      parent: _hold,
      curve: const Interval(1 / 6, 1, curve: Curves.easeOutSine),
      // The way back takes the whole close, on the menu's own exit curve.
      reverseCurve: KalloEase.exit,
    ),
  );

  /// Set from the moment the hold opens the menu until the menu resolves.
  /// Pushing the menu's route cancels the pointer still holding the bubble
  /// (the navigator cancels active pointers on a push), which reaches
  /// [release] as a cancelled long press — and must not shrink a bubble whose
  /// menu is opening.
  bool _menuOpen = false;

  /// A finger came down on the bubble.
  void press() => _hold.forward();

  /// The finger left (or the gesture lost) before the menu opened.
  void release() {
    if (!_menuOpen) _hold.reverse();
  }

  /// The hold fired and the menu is being pushed.
  void menuOpened() => _menuOpen = true;

  /// The menu resolved — as its close begins — or never opened.
  void menuClosed() {
    _menuOpen = false;
    _hold.reverse();
  }

  /// [child] at the current lift. The transform is paint-only, so a [key] on
  /// it still measures the resting rect the menu scales from.
  Widget wrap(Widget child, {Key? key}) => ScaleTransition(
    key: key,
    scale: _scale,
    alignment: Alignment.centerRight,
    child: child,
  );

  void dispose() => _hold.dispose();
}
