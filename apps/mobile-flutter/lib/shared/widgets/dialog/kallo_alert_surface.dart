/// The confirm dialog's card — its material, its metrics and its test handle.
///
/// Split out of `kallo_confirm.dart` (2026-09-07) when that file crossed the
/// 200-line widget limit. The seam is real rather than convenient: this is
/// what the alert is MADE of, while `kallo_confirm.dart` is what it SAYS.
///
/// **2026-10-28 (user decision): the iOS 26 in-app alert, minus Liquid
/// Glass.** Every metric below was measured off a real `UIAlertController`
/// presented by a probe app on the iOS 26.3 simulator (iPhone 17 Pro, 402pt).
/// The material stays the app's solid card; only the anatomy is the system's.
library;

import 'package:flutter/widgets.dart';

import '../../../theme/kallo_colors.dart';

/// The iOS 26 alert's width: 318pt on a 402pt phone.
const double kKalloAlertMaxWidth = 318;

/// The least room the card leaves either side, on a phone narrower than the
/// one it was measured on.
const double kKalloAlertEdgeInset = 20;

/// The card's width on a screen [screenWidth] wide.
double kalloAlertWidth(double screenWidth) =>
    (screenWidth - 2 * kKalloAlertEdgeInset).clamp(0, kKalloAlertMaxWidth);

/// The iOS 26 alert's corner. Measured as a continuous curve that meets the
/// straight edge ~28pt down; the pre-26 alert's was 14.
const double kKalloAlertRadius = 28;

/// Title and message stand in 30pt from the card's sides.
const double kKalloAlertTextInset = 30;

/// The pills stand in 15pt from the card's sides and bottom.
const double kKalloAlertActionInset = 15;

/// A pill's height, and the gap between two of them.
const double kKalloAlertActionHeight = 48;
const double kKalloAlertActionGap = 8;

/// How long the alert takes to come in, and the dim to leave. Recorded on the
/// iOS 26.3 simulator: the card starts ~8% large and settles while it fades
/// in, both done in ~0.25s; on the way out it does not shrink, it fades in
/// ~0.1s while the dim takes the full ~0.25s.
const Duration kKalloAlertFade = Duration(milliseconds: 250);

/// The scale the card enters from.
const double kKalloAlertEnterScale = 1.08;

/// The iOS 26 alert's motion, recorded on the simulator (2026-10-28): in, the
/// card fades up from [kKalloAlertEnterScale] and settles in ~0.25s; out, it
/// fades in ~0.1s with no shrink while the dim takes the full ~0.25s.
/// `showCupertinoDialog` still plays the pre-26 entrance — a 1.3x→1 zoom on a
/// ~0.4s spring — which is what read as janky beside it.
Widget kalloAlertTransition(
  BuildContext context,
  Animation<double> animation,
  Animation<double> secondaryAnimation,
  Widget child,
) => FadeTransition(
  opacity: CurvedAnimation(
    parent: animation,
    curve: Curves.easeOut,
    // Out: gone in the first 40% of the dim's fade.
    reverseCurve: const Interval(0.6, 1, curve: Curves.easeIn),
  ),
  child: ScaleTransition(
    scale: Tween<double>(begin: kKalloAlertEnterScale, end: 1).animate(
      CurvedAnimation(
        parent: animation,
        curve: Curves.easeOut,
        // Out: hold full size — the system alert does not shrink.
        reverseCurve: const Threshold(0),
      ),
    ),
    child: child,
  ),
);

/// A raw dialog route ignores `dialogTheme.barrierColor`, so the alert passes
/// the app's scrim explicitly. Same token the theme uses.
Color get kKalloAlertBarrier => KalloColors.scrim;

/// Finds the alert card in a widget test, and marks it in the tree.
///
/// It used to be found by `find.byType(CupertinoPopupSurface)`, which tied
/// four test files to the material the card happens to be made of. A key
/// survives the next time that changes.
const Key kKalloConfirmSurface = Key('kallo-confirm-surface');

/// The alert card: solid, clipped to [kKalloAlertRadius].
///
/// Replaces `CupertinoPopupSurface` (2026-09-07): no frosted, see-through
/// surface in an app whose design system names solid surfaces and no stacked
/// translucency (`calm_tokens.dart`). That is also why the iOS 26 anatomy came
/// over without its Liquid Glass.
class KalloAlertSurface extends StatelessWidget {
  const KalloAlertSurface({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) => ClipRSuperellipse(
    key: kKalloConfirmSurface,
    borderRadius: BorderRadius.circular(kKalloAlertRadius),
    child: ColoredBox(color: KalloColors.sheet, child: child),
  );
}
