import 'package:flutter/material.dart';

import '../../../../shared/widgets/brand/kallo_wordmark.dart';

/// The welcome screen's brand mark: the wordmark alone, at the canvas' 40pt
/// hero size (native pass, 2026-08-31).
///
/// The 64pt app-icon tile above it is gone. A launcher icon reprinted inside
/// the app it launched is the web habit this port arrived with — an iOS user
/// has just tapped that icon, so the screen behind it does not need to show it
/// back. The capital K in the wordmark IS the brand mark, which is why
/// [KalloWordmark] documents never pairing the two.
class AuthBrandHero extends StatelessWidget {
  const AuthBrandHero({super.key});

  /// Cap height of the wordmark. The canvas specifies the "Kallo" hero at 40;
  /// the wordmark's glyphs fill its box, so 40 here IS 40 on screen.
  static const double _height = 40;

  @override
  Widget build(BuildContext context) {
    return const Center(child: KalloWordmark(height: _height));
  }
}
