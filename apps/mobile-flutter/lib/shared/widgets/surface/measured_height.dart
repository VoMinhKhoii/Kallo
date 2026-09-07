import 'package:flutter/material.dart';

/// Reports [child]'s laid-out height to [onChanged] — once after the first
/// frame, and again after any layout that changes it by half a pixel or more.
///
/// Two docks needed exactly this (2026-09-07): the logging composer and the
/// Circle thread composer both float over a list that must reserve tail
/// padding equal to the dock's height, and both grow under the user's thumb
/// (a multiline field, cheat mode's extra controls) WITHOUT re-running the
/// dock's own build — the field's setState is internal to it. A post-frame
/// read on build alone would therefore go stale mid-type; the
/// [SizeChangedLayoutNotifier] is what catches a layout-driven resize.
///
/// Place it INSIDE any keyboard lift, not around it: the height reported is
/// then the dock's own, and the consumer adds the keyboard inset to its
/// reserve itself, in the same frame. Routing the lift through this
/// measurement would deliver it a frame late (the report is post-frame) and
/// rebuild the consumer on every frame of the keyboard's ~250ms ramp.
///
/// The half-pixel guard matters: sub-pixel churn between two layouts would
/// otherwise ping-pong the consumer's setState forever.
class MeasuredHeight extends StatefulWidget {
  const MeasuredHeight({
    required this.child,
    required this.onChanged,
    super.key,
  });

  final Widget child;

  /// Fired post-frame, only when the height actually moved.
  final ValueChanged<double> onChanged;

  @override
  State<MeasuredHeight> createState() => _MeasuredHeightState();
}

class _MeasuredHeightState extends State<MeasuredHeight> {
  final GlobalKey _key = GlobalKey();
  double _reported = 0;

  void _report() {
    if (!mounted) return;
    final height = _key.currentContext?.size?.height;
    if (height == null) return;
    if ((height - _reported).abs() < 0.5) return;
    _reported = height;
    widget.onChanged(height);
  }

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) => _report());
    return NotificationListener<SizeChangedLayoutNotification>(
      onNotification: (_) {
        // Fired during layout — defer the consumer's setState past this frame.
        WidgetsBinding.instance.addPostFrameCallback((_) => _report());
        return false;
      },
      child: SizeChangedLayoutNotifier(
        child: KeyedSubtree(key: _key, child: widget.child),
      ),
    );
  }
}
