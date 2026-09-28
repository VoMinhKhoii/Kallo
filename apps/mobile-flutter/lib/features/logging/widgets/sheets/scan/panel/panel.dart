import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../../../theme/kallo_motion.dart';
import 'scope.dart';

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

/// Where the sheet's content stops above the bottom: 12pt clear of the
/// keyboard, or on the home indicator's inset (the canvas's 34) — never both,
/// never flush. The sheet pads by it; a page's height leaves it out.
double scanSheetBottomInset(MediaQueryData media) {
  const dockGap = 12.0;
  final keyboard = media.viewInsets.bottom;
  return keyboard > 0
      ? keyboard + dockGap
      : math.max(media.padding.bottom, dockGap);
}

/// One page of the scan sheet (`ScanSheet`): a header, a body that scrolls,
/// and a dock pinned under it, standing at [height].
///
/// The sheet's surface, its gestures and the travel between pages are the
/// sheet's; a page says what its gestures do — [onDismiss], [onBack] — by
/// registering them with the sheet as it builds ([ScanSheetScope]).
class ScanPanel extends StatelessWidget {
  const ScanPanel({
    super.key,
    required this.height,
    required this.header,
    required this.body,
    this.dock,
    this.onDismiss,
    this.onBack,
  });

  final ScanPanelHeight height;

  /// A `KalloSheetHeader`.
  final Widget header;
  final Widget body;

  /// Pinned under the scrolling body — "Add meal", or a state's buttons.
  final Widget? dock;

  /// What a drag down or a tap outside does — the header's close. Null while
  /// the sheet may not close.
  final VoidCallback? onDismiss;

  /// A deeper page's swipe back — its header's back, or its cancel.
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    ScanSheetScope.maybeOf(context)
      ?..onDismiss = onDismiss
      ..onBack = onBack;
    final media = MediaQuery.of(context);
    final content = Column(
      mainAxisSize:
          height == ScanPanelHeight.fit ? MainAxisSize.min : MainAxisSize.max,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        header,
        if (height == ScanPanelHeight.fit)
          body
        else
          Expanded(
            child: SingleChildScrollView(
              physics: const ClampingScrollPhysics(),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
              child: body,
            ),
          ),
        if (dock != null) dock!,
      ],
    );
    if (height == ScanPanelHeight.fit) return content;
    // With the keyboard up every panel stands at full height: the field being
    // typed in must stay above the keys. The LEVEL glides (a drink's cup
    // ruler, the keyboard arriving); the keyboard's own inset is taken frame
    // for frame, so the sheet's top moves smoothly while its content never
    // sits behind the keys.
    final level = media.viewInsets.bottom > 0 ? ScanPanelHeight.full : height;
    return TweenAnimationBuilder<double>(
      tween: Tween(end: level.top),
      duration: KalloMotion.page,
      curve: KalloEase.decelerate,
      builder:
          (context, top, child) => SizedBox(
            height: media.size.height * (1 - top) - scanSheetBottomInset(media),
            child: child,
          ),
      child: content,
    );
  }
}
