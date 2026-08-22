import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/logging_providers.dart';

/// A meal parked by an off-feed composer — the dashboard's quick-log sheet, a
/// first-run suggestion chip — picked up by the feed and run exactly as if it
/// had been typed into the composer.
///
/// The whole difficulty is "exactly once": `build` runs many times (and does —
/// the post-frame gap alone can contain several) while the slot still holds the
/// same text, and every one of those builds would otherwise schedule its own
/// run of the analysis. [claim] and [take] are the two halves of one handshake.
class PendingMealHandoff {
  /// True from the moment a build sees a meal parked until that meal has been
  /// taken out of the provider.
  bool _claimed = false;

  /// Called from `build`. WATCHED, not listened to: the feed is routinely not
  /// mounted when the meal is parked (the profile fetch holds it behind a
  /// skeleton), so a listener would miss the transition outright — watching
  /// means the very first build that runs, whenever it runs, sees the value. It
  /// also covers the opposite case, an already-mounted feed on another tab:
  /// writing the provider marks that element dirty and the resulting build
  /// picks it up.
  ///
  /// [schedule] must defer [take] past the current frame: taking writes
  /// provider state and rebuilds the feed, neither legal during a build.
  void claim(WidgetRef ref, VoidCallback schedule) {
    final pending = ref.watch(pendingMealProvider);
    if (pending == null || _claimed) return;
    _claimed = true;
    schedule();
  }

  /// Empty the slot and release the claim, handing back the meal to run — null
  /// when the slot held nothing usable.
  ///
  /// The slot is emptied BEFORE the claim is released: for the whole window in
  /// which a rebuild could observe a value, the claim is still held, so no
  /// second run can be scheduled. Once both have happened the pair is back to
  /// (null, unclaimed) — ready for the next hand-off, and inert against a hot
  /// reload or a tab switch, which re-run `build` but never refill the slot.
  String? take(WidgetRef ref) {
    final text = ref.read(pendingMealProvider);
    ref.read(pendingMealProvider.notifier).state = null;
    _claimed = false;
    final meal = text?.trim() ?? '';
    return meal.isEmpty ? null : meal;
  }
}
