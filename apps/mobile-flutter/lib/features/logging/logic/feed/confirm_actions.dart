import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../../models/cheat.dart';
import '../../../../models/meal.dart';
import '../../../../shared/widgets/top_toast.dart';
import '../../data/logging_providers.dart';
import '../../data/stream_analysis_controller.dart';

const _uuid = Uuid();

/// The four ways a staged analysis becomes a saved meal: from a server-loaded
/// pending card (normal / cheat) and straight from the revealed answer the
/// stream is still holding (normal / cheat).
///
/// They all post the same confirm and differ only in which day owns the caches
/// and in what the reveal has to tear down afterwards, so the shared save lives
/// in [_save] and the callers stay a shape each.
class FeedConfirmActions {
  const FeedConfirmActions({
    required this.context,
    required this.ref,
    required this.userId,
    required this.date,
    required this.onError,
    required this.onRevealSaved,
  });

  final BuildContext context;
  final WidgetRef ref;
  final String userId;

  /// The selected day — the origin date for confirms that aren't reveals.
  final String date;

  /// A confirm failed: surface it inline (the feed's own error line).
  final VoidCallback onError;

  /// A REVEALED answer was saved: the local stream can be torn down so the
  /// revealed card hands off to the refetched persisted card.
  final VoidCallback onRevealSaved;

  /// Confirm a server-loaded pending card.
  Future<void> confirmPending(
    String analysisId,
    List<MealQuantityEdit> edits,
  ) async {
    await _save(analysisId: analysisId, originDate: date, edits: edits);
  }

  /// Confirm straight from the revealed answer (the morph card). The analysis is
  /// already stored server-side (analysis_complete); confirming persists it. On
  /// success we tear down the local stream so the revealed card hands off to the
  /// refetched persisted card — one continuous object from typed words to saved
  /// meal. On failure the stream stays so the user can retry the confirm.
  Future<void> confirmReveal(
    String analysisId,
    List<MealQuantityEdit> edits,
  ) async {
    // Confirm against the day the analysis was submitted on (the reveal is
    // date-guarded to that day), so the ORIGIN date's caches are updated.
    final originDate = ref.read(streamAnalysisProvider).loggedDate ?? date;
    final saved = await _save(
      analysisId: analysisId,
      originDate: originDate,
      edits: edits,
    );
    if (saved) onRevealSaved();
  }

  /// Confirm a server-loaded cheat pending card. The server recomputes
  /// nutrition from the staged spec + these levels — never client numbers.
  Future<void> confirmCheatPending(
    String analysisId,
    CheatSliderLevels levels,
  ) async {
    await _save(analysisId: analysisId, originDate: date, levels: levels);
  }

  /// Confirm straight from the revealed cheat slider card (the analysis is
  /// already staged — analysis_complete arrived with the spec). Mirrors
  /// [confirmReveal]: on success the stream resets so the card hands off to
  /// the refetched persisted cheat card.
  Future<void> confirmCheatReveal(CheatSliderLevels levels) async {
    final stream = ref.read(streamAnalysisProvider);
    final analysisId = stream.analysisId;
    if (analysisId == null) return;
    final originDate = stream.loggedDate ?? date;
    final saved = await _save(
      analysisId: analysisId,
      originDate: originDate,
      levels: levels,
    );
    if (saved) onRevealSaved();
  }

  Future<bool> _save({
    required String analysisId,
    required String originDate,
    List<MealQuantityEdit>? edits,
    CheatSliderLevels? levels,
  }) async {
    try {
      await ref
          .read(confirmMealProvider(userId).notifier)
          .confirm(
            analysisId: analysisId,
            mealId: _uuid.v4(),
            originDate: originDate,
            edits:
                edits == null || edits.isEmpty
                    ? null
                    : [
                      for (final e in edits)
                        {
                          'mealItemOrder': e.mealItemOrder,
                          'newGrams': e.newGrams,
                        },
                    ],
            levels: levels == null ? null : cheatLevelsToWire(levels),
          );
    } catch (_) {
      // confirm() rolls the optimistic removal back on failure; surface the
      // error too so it isn't silently swallowed.
      if (context.mounted) onError();
      return false;
    }
    // Saved — a success haptic + a top toast confirm the meal landed.
    HapticFeedback.mediumImpact();
    if (context.mounted) showTopToast(context, 'logging.feedArea.savedMeal'.tr());
    return true;
  }
}
