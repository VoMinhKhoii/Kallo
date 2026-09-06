import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import 'step_backdrop.dart';

/// An OPAQUE strip that continues the page's [StepBackdrop] instead of ending
/// it on a rectangle edge.
///
/// Two call sites need to cover what is behind them — the onboarding step's
/// CTA band (a long list scrolls under it) and `/save-plan`'s auth face (the
/// switcher slides one face over another). A flat canvas fill does the
/// covering, but the moment the page behind carries blobs it also draws a hard
/// horizontal seam straight across them. So the strip paints the canvas AND
/// the same blob field, bottom-aligned to [field] — the box the page's own
/// [StepBackdrop] fills — which makes it invisible against it.
///
/// [fadeHeight] softens the strip's own top edge: the top band ramps from
/// nothing to fully opaque, so content scrolling under it dissolves rather
/// than stopping dead. Over empty canvas the ramp is a no-op — it is the same
/// pixels at partial alpha over themselves — which is why it can simply always
/// be drawn.
class BackdropSlice extends StatelessWidget {
  const BackdropSlice({
    super.key,
    required this.field,
    this.child,
    this.fadeHeight = 0,
  });

  /// The box the page's [StepBackdrop] fills. The slice sits at its BOTTOM,
  /// which is where both call sites are.
  final Size field;

  /// What rides on the strip. Its height is the strip's height; omit it and
  /// the strip fills whatever box it is given.
  final Widget? child;

  /// How much of the strip's top ramps in. 0 = a hard (but seamless) edge.
  final double fadeHeight;

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      Positioned.fill(
        child: IgnorePointer(
          child: LayoutBuilder(builder: (context, box) => _paint(box.biggest)),
        ),
      ),
      child ?? const SizedBox.expand(),
    ],
  );

  Widget _paint(Size band) {
    final Widget slice = ClipRect(
      child: ColoredBox(
        color: kPage,
        child: OverflowBox(
          alignment: Alignment.bottomCenter,
          minWidth: 0,
          maxWidth: field.width,
          minHeight: 0,
          maxHeight: field.height,
          child: SizedBox.fromSize(size: field, child: const StepBackdrop()),
        ),
      ),
    );

    if (fadeHeight <= 0 || band.height <= 0) return slice;

    return ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback:
          (rect) => LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: const [Color(0x00000000), Color(0xFF000000)],
            stops: [0, (fadeHeight / band.height).clamp(0.0, 1.0)],
          ).createShader(rect),
      child: slice,
    );
  }
}
