/// A PURE relog — picks with no free text around them — and the attempt ids
/// that make resubmitting one idempotent.
///
/// Nothing is written to the day here: the stage produces a pending analysis
/// and the day refetch surfaces it as the ordinary editable review card, the
/// same shape an AI meal goes through.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../../models/logging/relog.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../data/relog_providers.dart';
import '../../widgets/relog/mention_text_controller.dart';

const _uuid = Uuid();

/// Attempt ids for pure-relog submits, keyed by the selection they staged.
///
/// Retrying the same picks must reuse its id so the server's
/// `(user_id, attempt_id)` upsert overwrites the row it already wrote. Without
/// that, a stage that commits but loses its response — the composer is left
/// untouched, so the user resubmits — writes a SECOND pending row, and one
/// meal arrives as two cards to confirm.
///
/// An entry is dropped once its stage is known to have landed. Changing the
/// picks changes the key, which is what mints a new id for a new meal.
class RelogAttemptLedger {
  final Map<String, String> _ids = {};

  /// The id [stageIds] staged under, minting one on first use.
  String idFor(Set<String> stageIds) =>
      _ids.putIfAbsent(_key(stageIds), _uuid.v4);

  /// The stage landed — the next submit of these same picks is a new meal and
  /// must not overwrite the row this id already wrote.
  void release(Set<String> stageIds) => _ids.remove(_key(stageIds));

  /// Order-insensitive: the picks arrive in composer order, which shifts when
  /// one is inserted ahead of another, and that is not a different selection.
  static String _key(Set<String> stageIds) =>
      (stageIds.toList()..sort()).join('|');
}

/// Stage a deterministic relog analysis and let the day refetch surface its
/// review card. Nothing is written to the day until the user confirms it,
/// exactly as with an AI meal.
///
/// [onStagingChange] drives the caller's in-flight flag — the guard that covers
/// a double tap beating the rebuild. [onStaged] runs only once the stage has
/// landed.
Future<void> stagePureRelog(
  BuildContext context,
  WidgetRef ref, {
  required RelogAttemptLedger ledger,
  required MentionTextEditingController composer,
  required String userId,
  required String date,
  required List<RelogRef> refs,
  required List<String> stageIds,
  required VoidCallback onStaged,
  required ValueChanged<bool> onStagingChange,
}) async {
  onStagingChange(true);
  final selection = stageIds.toSet();
  try {
    await stageRelogAnalysis(
      ref,
      userId: userId,
      date: date,
      items: refs,
      // Never the feed's own attempt id: the server upserts pending analyses on
      // (user_id, attempt_id), so borrowing the id of a revealed-but-
      // unconfirmed AI card would overwrite that card's row with this relog.
      //
      // Stable across retries of the SAME picks, though — see
      // [RelogAttemptLedger].
      attemptId: ledger.idFor(selection),
    );
    // Only what was actually SUBMITTED, and only after staging lands. The
    // field stays editable throughout, so a pick made while the POST was in
    // flight is not ours to clear — it was never sent.
    composer.consumeMentions(selection);
    ledger.release(selection);
    // The feed's attempt id is deliberately untouched: it belongs to whatever
    // AI attempt is on screen, and a relog is a separate card.
    onStaged();
  } catch (_) {
    if (context.mounted) showTopToast(context, 'errors.internal'.tr());
  } finally {
    if (context.mounted) onStagingChange(false);
  }
}
