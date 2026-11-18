import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'start_device_preview.dart';
import 'start_preview_box.dart';

/// The device and its dishes: the far pane of every signed-out screen beside
/// the fold. `/start` opens on it, and sign-in, the wizard and `/save-plan`
/// keep it standing while the other half changes.
///
/// No wordmark. Each near pane wears one in its own column, and a mark on
/// this side as well would say the name twice; the pane can only stand still
/// if it is the same on every screen, so it is the preview alone.
///
/// A [Hero], so a push between those routes leaves it where it is instead of
/// sliding one copy over another.
class StartHero extends StatelessWidget {
  const StartHero({super.key});

  /// How far the top two dishes rise over the device card at scale 1: the
  /// bánh mì starts 29pt above it, and its tilt lifts a corner further.
  static const double _dishReach = 40;

  /// Where the art still reads at scale 1: the dissolve starts at
  /// [StartDevicePreview.fadeTop], and halfway through it the art is mostly
  /// gone. The block's box runs on past this, faded to nothing.
  static const double _artBottom =
      StartDevicePreview.fadeTop +
      (StartDevicePreview.blockHeight - StartDevicePreview.fadeTop) / 2;

  /// Clear air above the dishes and below the art.
  static const double _margin = 24;

  @override
  Widget build(BuildContext context) => const Hero(
    tag: 'start-hero',
    transitionOnUserGestures: true,
    // In flight the pane's own clip is gone, and the dishes bleed past the
    // pane on both sides by design.
    child: ClipRect(
      child: SafeArea(
        minimum: EdgeInsets.only(top: 12),
        child: LayoutBuilder(builder: _place),
      ),
    ),
  );

  /// Centres what the eye sees (the dishes on top down to the dissolve) on
  /// the pane, rather than the block's box, whose bottom is mostly faded:
  /// centring the box left the art riding high and cut the top dishes at the
  /// display's edge. The faded tail may run past the pane, which clips it.
  static Widget _place(BuildContext context, BoxConstraints box) {
    const art = _dishReach + _artBottom;
    final scale = math.min(
      (box.maxHeight - 2 * _margin) / art,
      StartPreviewBox.maxScale,
    );
    final top = (box.maxHeight - art * scale) / 2 + _dishReach * scale;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned(
          left: 0,
          right: 0,
          top: top,
          height: StartPreviewBox.visibleHeight * scale,
          child: const StartPreviewBox(),
        ),
      ],
    );
  }
}
