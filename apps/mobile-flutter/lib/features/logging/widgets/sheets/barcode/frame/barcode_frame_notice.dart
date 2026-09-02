/// The barcode frame's own status capsule and the routes it offers.
///
/// Lives beside the camera view it is drawn over: this is the layer that turns
/// a failed lookup into a line ON the picture instead of a panel that replaces
/// it.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_colors.dart';
import '../../../../../../theme/kallo_theme.dart';

/// One quiet way out of a barcode we could not resolve. A text link, not a
/// button: none of these is the primary action — the live camera is.
class BarcodeFrameRoute {
  const BarcodeFrameRoute({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;
}

/// The frame's status capsule: the lookup spinner, then the miss.
///
/// It sits over the live view, in the hint's slot, and it replaces the panel a
/// failed lookup used to collapse the sheet into (a red alert puck, the raw
/// code, and FOUR stacked full-width actions — one of them "Scan again" for a
/// scanner that had never stopped). A barcode Open Food Facts has never heard
/// of is a MISS, not an error: the camera stays live, so scanning again is
/// simply pointing the phone at the next package, and the only thing left to
/// offer is the other ways IN — quietly, as [routes].
class BarcodeFrameNotice extends StatelessWidget {
  const BarcodeFrameNotice({
    super.key,
    required this.message,
    this.detail,
    this.busy = false,
    this.routes = const [],
  });

  final String message;

  /// The scanned code. Quiet, but worth keeping: it is what the user reads out
  /// to themselves on the manual path.
  final String? detail;

  /// A lookup is in flight — the message gets a spinner.
  final bool busy;

  final List<BarcodeFrameRoute> routes;

  @override
  Widget build(BuildContext context) {
    final code = detail;
    return Semantics(
      container: true,
      liveRegion: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          // The stage's own scrim family (the torch button's off state), one
          // step darker so 15pt copy holds over a moving picture.
          color: Colors.black.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(KalloRadii.container20),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: KalloSpacing.sp4,
            vertical: KalloSpacing.sp3,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (busy) ...[
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: KalloColors.bandForeground,
                  ),
                ),
                const SizedBox(height: KalloSpacing.sp2),
              ],
              Text(
                message,
                textAlign: TextAlign.center,
                style: dashMeta(
                  color: KalloColors.bandForeground,
                ),
              ),
              if (code != null && code.isNotEmpty) ...[
                const SizedBox(height: KalloSpacing.sp0_5),
                Text(
                  code,
                  textAlign: TextAlign.center,
                  style: dashMeta(
                    color: KalloColors.bandForeground70,
                    tabular: true,
                  ),
                ),
              ],
              if (routes.isNotEmpty)
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: KalloSpacing.sp4,
                  children: [
                    for (final route in routes) _RouteLink(route: route),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A route out, as a link on the stage: label only, in a 44pt target.
class _RouteLink extends StatelessWidget {
  const _RouteLink({required this.route});

  final BarcodeFrameRoute route;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: route.label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.selectionClick();
          route.onTap();
        },
        child: Container(
          constraints: const BoxConstraints(minHeight: KalloIcons.hit),
          alignment: Alignment.center,
          child: Text(
            route.label,
            textAlign: TextAlign.center,
            // The app's own text-link treatment (the auth footer's), in the
            // on-dark palette: without the rule these read as two more
            // sentences of the message they sit under.
            style: dashMeta(
              color: KalloColors.bandForeground,
            ).copyWith(
              decoration: TextDecoration.underline,
              decorationColor: KalloColors.bandForeground70,
            ),
          ),
        ),
      ),
    );
  }
}
