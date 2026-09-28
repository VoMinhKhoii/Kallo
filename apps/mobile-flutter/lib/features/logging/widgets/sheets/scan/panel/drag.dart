import 'package:flutter/widgets.dart';

import '../../../../../../../theme/kallo_motion.dart';

/// Where a dragged scan panel is, and where it goes when the finger lifts:
/// down past [dismissDistance] (or flung) it goes, right past a third of its
/// width (or flung) it goes back a level, and short of either it springs home.
///
/// The physics apart from the wiring (`ScanPanelGestures`): the thresholds and
/// the settle are the part worth reading on their own.
class ScanPanelDrag {
  ScanPanelDrag({required TickerProvider vsync})
    : _settle = AnimationController(vsync: vsync, duration: KalloMotion.quick) {
    _settle.addListener(() {
      final tween = _tween;
      if (tween != null) offset.value = tween.value;
    });
  }

  static const double dismissDistance = 120;
  static const double flingVelocity = 700;
  static const double backFraction = 0.33;

  /// The panel's travel: down for a dismiss, right for a back.
  final ValueNotifier<Offset> offset = ValueNotifier(Offset.zero);

  final AnimationController _settle;
  Animation<Offset>? _tween;

  bool get isPulledDown => offset.value.dy > 0;

  void dispose() {
    _settle.dispose();
    offset.dispose();
  }

  void _animateTo(Offset target, {VoidCallback? then}) {
    _tween = Tween(
      begin: offset.value,
      end: target,
    ).animate(CurvedAnimation(parent: _settle, curve: KalloEase.decelerate));
    _settle.forward(from: 0).whenComplete(() => then?.call());
  }

  /// Follow the finger down; never above where the panel rests.
  void down(double delta) {
    _settle.stop();
    final next = (offset.value.dy + delta).clamp(0.0, double.infinity);
    offset.value = Offset(0, next);
  }

  /// Released after a pull down: [dismiss], or spring home. A dismissed
  /// panel is left where it is — the screen's switcher slides it on out.
  void endDown(double velocity, VoidCallback? dismiss) {
    final dy = offset.value.dy;
    if (dy <= 0) return;
    if (dismiss != null && (velocity > flingVelocity || dy > dismissDistance)) {
      dismiss();
    } else {
      _animateTo(Offset.zero);
    }
  }

  /// Follow the finger right; never left of where the panel rests.
  void back(double delta) {
    _settle.stop();
    final next = (offset.value.dx + delta).clamp(0.0, double.infinity);
    offset.value = Offset(next, 0);
  }

  /// Released after a swipe right: the level slides the rest of the way out
  /// and [onBack] shows the first one in its place — or it springs home.
  void endBack(double velocity, double width, VoidCallback? onBack) {
    final dx = offset.value.dx;
    if (onBack != null &&
        (velocity > flingVelocity || dx > width * backFraction)) {
      _animateTo(
        Offset(width, 0),
        then: () {
          onBack();
          offset.value = Offset.zero;
        },
      );
    } else {
      _animateTo(Offset.zero);
    }
  }
}
