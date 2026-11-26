import 'package:flutter/widgets.dart';
import 'package:kallo_mobile/shell/window/keep_clear_zones.dart';
import 'package:kallo_mobile/shell/window/window_layout.dart';

/// Gallery renders only: paints the control column's keep-clear corners
/// ([WindowLayout.keepClear]) as a faint tint over the app, so anything of
/// ours that strays into them shows in the picture.
class KeepClearTint extends StatelessWidget {
  const KeepClearTint({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final rects =
        WindowLayout.resolve(
          MediaQuery.sizeOf(context),
          MediaQuery.viewPaddingOf(context),
        ).keepClear;
    return Stack(
      fit: StackFit.expand,
      children: [
        child,
        IgnorePointer(child: CustomPaint(painter: _Tint(rects))),
      ],
    );
  }
}

class _Tint extends CustomPainter {
  const _Tint(this.rects);
  final List<Rect> rects;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = const Color(0x2EE0207A);
    for (final rect in rects) {
      canvas.drawRect(rect, paint);
    }
  }

  @override
  bool shouldRepaint(_Tint old) => old.rects != rects;
}
