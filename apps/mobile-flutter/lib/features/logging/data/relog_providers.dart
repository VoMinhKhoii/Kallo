/// Riverpod state for the composer's `/` relog picker: the deterministic
/// candidate search, and the staging call that turns picked references into a
/// pending analysis.
///
/// Both halves are AI-free. The search is a pair of indexed queries over the
/// user's own history; the stage call copies stored `meal_items` rows verbatim.
/// Mirrors the web hooks `use-relog-candidates` / `use-relog-submit`.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api_client.dart';
import '../../../models/relog.dart';
import 'logging_keys.dart';
import 'logging_providers.dart';

/// Candidate search for the `/` picker. Deterministic and server-side — the
/// query text goes straight to SQL, so there is nothing to filter here.
///
/// An empty query is NOT a special case: the frequency×recency score already
/// surfaces the user's staples, so there is no separate "recents" request to
/// keep in sync. Entries are kept alive briefly (the `ingredientSearchProvider`
/// idiom) so backspacing through a word — and reopening the picker — resolves
/// from cache instead of refetching.
final relogCandidatesProvider = FutureProvider.autoDispose
    .family<RelogCandidatesResponse, String>((ref, query) async {
      final link = ref.keepAlive();
      Timer? timer;
      ref.onDispose(() => timer?.cancel());
      ref.onCancel(() {
        timer = Timer(const Duration(minutes: 5), link.close);
      });
      ref.onResume(() => timer?.cancel());

      final api = ref.watch(apiClientProvider);
      final q = query.trim();
      final path =
          q.isEmpty
              ? '/api/v1/meals/relog/candidates?limit=$kRelogSearchLimit'
              : '/api/v1/meals/relog/candidates'
                  '?q=${Uri.encodeQueryComponent(q)}&limit=$kRelogSearchLimit';
      final json = await api.get<Map<String, dynamic>>(path);
      return RelogCandidatesResponse.fromJson(json);
    });

/// Stage the picked references as a pending analysis
/// (`POST /api/v1/meals/relog/stage`), then refresh the day so the staged card
/// surfaces in the ordinary editable review card — the same stage-then-show
/// shape as `stageCheatRepeat`.
///
/// Nothing is written to `meals` until the user confirms that card. The body
/// carries only references: no nutrition, grams or names cross the wire, and
/// the server re-resolves each one under the authenticated user.
///
/// [attemptId] must be FRESH per staged relog, never the feed's current attempt
/// id: the server upserts pending analyses on `(user_id, attempt_id)`, so
/// reusing the id of a revealed-but-unconfirmed AI card would overwrite that
/// card's row with this relog. Double submits are held off by the caller's
/// in-flight flag instead — the same guard web uses.
Future<void> stageRelogAnalysis(
  WidgetRef ref, {
  required String userId,
  required String date,
  required List<RelogRef> items,
  String? attemptId,
}) async {
  final api = ref.read(apiClientProvider);
  await api.post<Map<String, dynamic>>('/api/v1/meals/relog/stage', {
    'items': items.map((item) => item.toJson()).toList(),
    'loggedDate': date,
    'timezoneOffset': timezoneOffsetMinutes(),
    if (attemptId != null) 'attemptId': attemptId,
  });
  // The stage COMMITTED the moment the POST returned. A refetch that fails
  // afterwards (flaky network) must not surface as a staging failure: the
  // caller would keep the picks, the user would resubmit, and a fresh attempt
  // id would stage a SECOND pending row — two review cards for one meal. Fall
  // back to invalidation, as `logMealAgain` does for the same reason.
  final day = LoggingDayArgs(userId, date);
  try {
    await ref.read(loggingDayProvider(day).notifier).refresh();
  } catch (_) {
    ref.invalidate(loggingDayProvider(day));
  }
  // The picks just gained an occurrence, which is what the candidate ranking
  // scores on — drop the cached searches so the next `/` reflects it. Done here
  // rather than in `invalidateMealSurfaces` because that lives in
  // logging_providers, and importing this file from there would close an import
  // cycle for what is only a suggestion cache.
  ref.invalidate(relogCandidatesProvider);
}
