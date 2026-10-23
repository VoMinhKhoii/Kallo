import 'dart:ui' show ImageFilter;

import 'package:flutter/widgets.dart';

import '../../theme/calm_tokens.dart';
import '../../theme/kallo_colors.dart';
import '../../theme/kallo_palette.dart';
import '../../theme/kallo_theme.dart';

/// The pill nav's capsule — its fill, edge and shadow, per palette.
///
/// - Light: the white card surface and [kNavShadows], as it always was.
/// - Dark: [KalloColors.sheet], one step above the cards, with a 1px white
///   edge at 6% — a shadow cannot lift anything off a near-black page.
/// - Aurora: the sheet at 82% over a 20pt blur of what scrolls beneath, with
///   a 1px white edge at 7% — glass over the glow.
class PillNavSurface extends StatelessWidget {
  const PillNavSurface({super.key, required this.child});

  final Widget child;

  static const _darkEdge = Color(0x0FFFFFFF); // white @ 6%
  static const _auroraEdge = Color(0x12FFFFFF); // white @ 7%

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(kNavRadius);
    final palette = KalloPalette.currentId;
    final capsule = Container(
      // No max width: the capsule takes everything [kNavInset] leaves it, so
      // it is derived from the screen rather than pinned to one phone. Under
      // Center's loose constraints `infinity` resolves to that padded width.
      width: double.infinity,
      height: kNavHeight,
      padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3_5),
      decoration: BoxDecoration(
        color: switch (palette) {
          KalloPaletteId.light => kCardSurface,
          KalloPaletteId.dark => KalloColors.sheet,
          KalloPaletteId.aurora => KalloColors.sheet.withAlpha(0xD1), // 82%
        },
        borderRadius: radius,
        border: switch (palette) {
          KalloPaletteId.light => null,
          KalloPaletteId.dark => Border.all(color: _darkEdge),
          KalloPaletteId.aurora => Border.all(color: _auroraEdge),
        },
        boxShadow: kNavShadows,
      ),
      child: child,
    );
    if (palette != KalloPaletteId.aurora) return capsule;
    return ClipRRect(
      borderRadius: radius,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: capsule,
      ),
    );
  }
}
