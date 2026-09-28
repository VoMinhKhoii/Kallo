import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_shapes.dart';

/// How high a scan panel stands over the frozen camera — the owner's levels.
/// Fractions of the screen measured from the TOP (the 844pt artboards: 214,
/// 140, 54), or [fit] for a panel that hugs its content (the miss states,
/// typing a barcode).
enum ScanPanelHeight {
  /// A plain result: the photo keeps the top quarter.
  result(214 / 844),

  /// A dense result (the cup ruler) and the other nutrients: one level up,
  /// so nothing crowds Add meal and the photo still shows above.
  dense(140 / 844),

  /// The editor, and any panel while the keyboard is up: nearly the whole
  /// screen.
  full(54 / 844),

  /// As tall as its content, sitting on the keyboard when one is up.
  fit(0);

  const ScanPanelHeight(this.top);

  final double top;
}

/// A sheet that rises INSIDE the scan screen, over the frozen camera.
///
/// **Why not a sheet route** (the `Cupertino wins` rule's exception, with its
/// defect): `CupertinoSheetRoute` has one height — no detents — and a second
/// route would scale the camera route back and away, taking the scanned
/// product out of view, which is the whole point of the frozen frame above.
/// Retire this if the SDK's sheet gains detents that leave the route behind it
/// in place.
///
/// Painted in the canvas colour so the result's white cards separate by
/// surface, as on a page; corners at [kSheetRadius], concentric with the
/// header's controls.
class ScanPanel extends StatelessWidget {
  const ScanPanel({
    super.key,
    required this.height,
    required this.header,
    required this.body,
    this.dock,
  });

  final ScanPanelHeight height;

  /// A `KalloSheetHeader`.
  final Widget header;
  final Widget body;

  /// Pinned under the scrolling body — "Add meal", or a state's buttons.
  final Widget? dock;

  static const double _dockGap = 12;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final keyboard = media.viewInsets.bottom;
    final screen = media.size.height;
    // With the keyboard up every panel stands at full height: the field being
    // typed in must stay above the keys.
    final top =
        height == ScanPanelHeight.fit
            ? null
            : (keyboard > 0 ? ScanPanelHeight.full.top : height.top) * screen;

    final surface = DecoratedBox(
      decoration: ShapeDecoration(
        color: kPage,
        shape: KalloShapes.squircleTop(kSheetRadius),
        shadows: kSheetShadows,
      ),
      child: Padding(
        // The dock stands 12pt clear of the keyboard, or on the home
        // indicator's inset (the canvas's 34) — never both, never flush.
        padding: EdgeInsets.only(
          bottom:
              keyboard > 0
                  ? keyboard + _dockGap
                  : math.max(media.padding.bottom, _dockGap),
        ),
        child: Column(
          mainAxisSize:
              height == ScanPanelHeight.fit
                  ? MainAxisSize.min
                  : MainAxisSize.max,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            header,
            if (height == ScanPanelHeight.fit)
              body
            else
              Expanded(
                child: SingleChildScrollView(
                  physics: const ClampingScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                  child: body,
                ),
              ),
            if (dock != null) dock!,
          ],
        ),
      ),
    );

    return top == null
        ? Align(alignment: Alignment.bottomCenter, child: surface)
        : Padding(padding: EdgeInsets.only(top: top), child: surface);
  }
}
