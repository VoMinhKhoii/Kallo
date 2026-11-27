import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../shell/window/window_layout.dart';
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

  /// How far the dishes reach past the device card at scale 1. Above, the
  /// bánh mì starts 29pt over it and its tilt lifts a corner further. Below,
  /// the pasta and the curry end 54pt under it.
  static const double _reachAbove = 40;
  static const double _reachBelow =
      StartPreviewBox.visibleHeight - StartDevicePreview.cardHeight;

  /// How far the dishes reach sideways from the canvas's centre line at
  /// scale 1. On the right the sushi plate ends 187pt out, on the left the
  /// phở starts 197pt out. Only the side at the fold counts: off the
  /// display's own edge a dish may run, as it does on a phone.
  static const double _reachRight = 190;
  static const double _reachLeft = 200;

  /// Clear air between the dishes and the display's edge.
  static const double _margin = 12;

  @override
  Widget build(BuildContext context) {
    final padding = MediaQuery.paddingOf(context);
    // The far pane stands right of the fold when the column is on the left.
    final toFold = WindowLayout.of(context).nearLeft ? _reachLeft : _reachRight;
    final inset = EdgeInsets.only(
      top: math.max(padding.top, 12),
      bottom: padding.bottom,
    );
    return Hero(
      tag: 'start-hero',
      transitionOnUserGestures: true,
      // In flight the pane's own clip is gone, and the dishes bleed past the
      // pane's outer edge by design.
      child: ClipRect(
        child: Padding(
          padding: inset,
          child: LayoutBuilder(builder: (_, box) => _place(box, inset, toFold)),
        ),
      ),
    );
  }

  /// Centres the device on the pane, on the line the near pane centres its
  /// own column on (the middle of the safe area), and shows it whole. No
  /// wordmark sits above it and no title below it here, so nothing needs the
  /// room the single column leaves or the fade it sets its title in.
  ///
  /// It is as large as the dishes allow: the ones over and under the card
  /// stay on the display, where they may stand in the safe area's own strip,
  /// and the ones beside it stop short of the fold.
  static Widget _place(BoxConstraints box, EdgeInsets inset, double toFold) {
    const card = StartDevicePreview.cardHeight;
    final half = box.maxHeight / 2;
    final scale = [
      (half + inset.top - _margin) / (card / 2 + _reachAbove),
      (half + inset.bottom - _margin) / (card / 2 + _reachBelow),
      box.maxWidth / 2 / toFold,
      StartPreviewBox.maxScale,
    ].reduce(math.min);
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned(
          left: 0,
          right: 0,
          top: half - card * scale / 2,
          height: StartPreviewBox.visibleHeight * scale,
          child: const StartPreviewBox(dissolve: false),
        ),
      ],
    );
  }
}
