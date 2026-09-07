/// The confirm dialog's card — its material, its metrics and its test handle.
///
/// Split out of `kallo_confirm.dart` (2026-09-07) when that file crossed the
/// 200-line widget limit. The seam is real rather than convenient: this is
/// what the alert is MADE of, while `kallo_confirm.dart` is what it SAYS.
library;

import 'package:flutter/widgets.dart';

import '../../../theme/calm_tokens.dart';

/// A system alert is 270pt wide on every iPhone. Matching it is most of what
/// makes a custom card read as the platform's own.
const double kKalloAlertWidth = 270;

/// The corner `CupertinoPopupSurface` drew, kept when its material was not.
const double kKalloAlertRadius = 14;

/// The app's one scrim — `dialogTheme.barrierColor` in `kallo_theme.dart`.
const Color kKalloAlertBarrier = Color(0x80000000);

/// Finds the alert card in a widget test, and marks it in the tree.
///
/// It used to be found by `find.byType(CupertinoPopupSurface)`, which tied
/// four test files to the material the card happens to be made of. A key
/// survives the next time that changes.
const Key kKalloConfirmSurface = Key('kallo-confirm-surface');

/// The alert card: solid white, clipped to [kKalloAlertRadius].
///
/// Replaces `CupertinoPopupSurface` (2026-09-07). The clip is what keeps a
/// pressed action's full-width wash inside the card's corners — without it the
/// top and bottom rows square off the card the moment they are held.
class KalloAlertSurface extends StatelessWidget {
  const KalloAlertSurface({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) => ClipRRect(
    key: kKalloConfirmSurface,
    borderRadius: BorderRadius.circular(kKalloAlertRadius),
    child: ColoredBox(color: kCardSurface, child: child),
  );
}
