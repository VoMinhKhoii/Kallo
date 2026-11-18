import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/brand/kallo_wordmark.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// The welcome screen's brand block: the wordmark at the canvas' 40pt hero
/// size (native pass, 2026-08-31) and its one muted line under it.
///
/// One widget for both arrangements: on a phone [WelcomeView] centres it in
/// the space over the buttons, and beside the fold [AuthPage] stands it
/// directly over them.
///
/// The 64pt app-icon tile that once sat above the wordmark is gone. A
/// launcher icon reprinted inside the app it launched is the web habit this
/// port arrived with: an iOS user has just tapped that icon, so the screen
/// behind it does not need to show it back. The capital K in the wordmark IS
/// the brand mark, which is why [KalloWordmark] documents never pairing the
/// two.
class AuthBrandHero extends StatelessWidget {
  const AuthBrandHero({super.key});

  /// Cap height of the wordmark. The canvas specifies the "Kallo" hero at 40;
  /// the wordmark's glyphs fill its box, so 40 here IS 40 on screen.
  static const double _height = 40;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const Center(child: KalloWordmark(height: _height)),
      const SizedBox(height: KalloSpacing.sp2),
      // One quiet muted line: the wordmark is the headline here.
      Text(
        tr('auth.welcome.tagline'),
        textAlign: TextAlign.center,
        style: dashBody(color: kInkMuted),
      ),
    ],
  );
}
