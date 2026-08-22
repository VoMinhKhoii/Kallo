import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../../../../theme/kallo_colors.dart';

/// Inline loaders ported from the SVG-Loaders collection
/// (https://github.com/SamHerbert/SVG-Loaders, MIT) — the same source the web
/// app adapts in `components/shared/svg-loaders.tsx`.
///
/// All draw in a passed-in colour (the Dart equivalent of the web's
/// `currentColor`) and all are decorative: pair one with a live-region status
/// label, never with a semantics label of its own.

/// Builds the painter for one loader against the shared clock.
typedef LoaderPainterBuilder =
    CustomPainter Function(ValueListenable<double> clock, Color color);

/// Where the clock rests when the platform asks for reduced motion.
///
/// Picked by rendering the whole pool at several offsets and choosing the one
/// where every loader reads: at 0 the ECG has drawn nothing and the drip has
/// not fallen; by here the trace has its spike and the drip its ripple.
const double _restingSeconds = 0.95;

/// One loader in the pool.
@immutable
class SvgLoaderSpec {
  const SvgLoaderSpec({
    required this.id,
    required this.painter,
    this.widthFactor = 1,
    this.heightFactor = 1,
  });

  /// Stable identifier — the upstream file name (`three-dots`, `ball-triangle`).
  final String id;

  /// Rendered size as a multiple of the requested size. Most loaders are square
  /// (1, 1); the wide ones (three-dots is 4:1 in its viewBox) draw shorter and
  /// wider so they carry the same visual weight as the squares beside them.
  final double widthFactor;
  final double heightFactor;

  final LoaderPainterBuilder painter;

  Size sizeFor(double size) => Size(size * widthFactor, size * heightFactor);
}

/// Base for every loader painter: repaints off the shared clock and exposes the
/// elapsed seconds each painter samples its own timings from.
abstract class LoaderPainter extends CustomPainter {
  LoaderPainter(this.clock, this.color) : super(repaint: clock);

  final ValueListenable<double> clock;
  final Color color;

  double get seconds => clock.value;

  @override
  bool shouldRepaint(covariant LoaderPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.clock != clock;
}

/// Renders a [SvgLoaderSpec], driving it from a raw [Ticker].
///
/// A ticker rather than an `AnimationController` because these loaders have
/// PER-ELEMENT durations (audio alone runs four bars at 4.3s / 2s / 1.4s / 2s)
/// and negative pre-rolls. A 0→1 controller would need their lowest common
/// multiple as its period and would wrap visibly; a monotonic seconds clock is
/// what SMIL actually models.
class SvgLoaderView extends StatefulWidget {
  const SvgLoaderView({
    super.key,
    required this.spec,
    this.size = 20,
    this.color = KalloColors.textMuted,
  });

  final SvgLoaderSpec spec;
  final double size;
  final Color color;

  @override
  State<SvgLoaderView> createState() => _SvgLoaderViewState();
}

class _SvgLoaderViewState extends State<SvgLoaderView>
    with SingleTickerProviderStateMixin {
  final ValueNotifier<double> _clock = ValueNotifier<double>(0);
  late final Ticker _ticker = createTicker((elapsed) {
    _clock.value = elapsed.inMicroseconds / Duration.microsecondsPerSecond;
  });

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reduced motion: hold one still frame instead of animating — the same
    // seam `pulse.dart` and the old streaming spinner use.
    //
    // NOT frame zero. Several loaders are mid-gesture by design and start
    // empty — the ECG trace has drawn nothing at t=0, the drip has not fallen —
    // so pinning to zero would show a reduced-motion user a blank box. A small
    // offset lands every loader somewhere legible.
    if (MediaQuery.disableAnimationsOf(context)) {
      if (_ticker.isActive) _ticker.stop();
      _clock.value = _restingSeconds;
    } else if (!_ticker.isActive) {
      _ticker.start();
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    _clock.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: CustomPaint(
          size: widget.spec.sizeFor(widget.size),
          painter: widget.spec.painter(_clock, widget.color),
        ),
      ),
    );
  }
}
