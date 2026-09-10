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

import '../../../services/http/api_client.dart';
import '../../../models/logging/relog.dart';
import 'logging_keys.dart';
import 'logging_providers.dart';

/// Family key for [relogCandidatesProvider]: the OWNER plus the query.
///
/// The user id is not decoration. What comes back is the signed-in user's own
/// meal history — dish names, macros, source meal ids — and the entry is held
/// for five minutes after the picker closes. Keyed on the query alone, a second
/// account signing in on the same device hits a warm cache and is handed the
/// previous account's meals with no request made. The server's ownership checks
/// stop it being COPIED; they cannot stop it being SHOWN.
///
/// `ingredientSearchProvider` keys on its query alone and is right to: it
/// searches the shared food catalogue, which belongs to nobody. Anything
/// user-scoped follows `recentCheatOccasionsProvider` and carries the id.
class RelogCandidatesArgs {
  const RelogCandidatesArgs(this.userId, this.query);
  final String userId;
  final String query;

  @override
  bool operator ==(Object other) =>
      other is RelogCandidatesArgs &&
      other.userId == userId &&
      other.query == query;

  @override
  int get hashCode => Object.hash(userId, query);
}

/// Candidate search for the `/` picker. Deterministic and server-side — the
/// query text goes straight to SQL, so there is nothing to filter here.
///
/// An empty query is NOT a special case: the frequency×recency score already
/// surfaces the user's staples, so there is no separate "recents" request to
/// keep in sync. Entries are kept alive briefly (the `ingredientSearchProvider`
/// idiom) so backspacing through a word — and reopening the picker — resolves
/// from cache instead of refetching.
final relogCandidatesProvider = FutureProvider.autoDispose
    .family<RelogCandidatesResponse, RelogCandidatesArgs>((ref, args) async {
      final query = args.query;
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
/// [attemptId] is REQUIRED, and must be FRESH per staged relog.
///
/// Required because the server upserts on `(user_id, attempt_id)` and NULLs
/// never conflict — omitting it would make every call insert another fat
/// pending row that nothing collects promptly.
///
/// Fresh because reusing the id of a revealed-but-unconfirmed AI card would
/// make that upsert overwrite the card's row with this relog. Double submits
/// are held off by the caller's in-flight flag instead — the guard web uses.
Future<void> stageRelogAnalysis(
  WidgetRef ref, {
  required String userId,
  required String date,
  required List<ComposerPickRef> items,
  required String attemptId,
  String? displayText,
}) async {
  final api = ref.read(apiClientProvider);
  await api.post<Map<String, dynamic>>('/api/v1/meals/relog/stage', {
    'items': items.map((item) => item.toJson()).toList(),
    'loggedDate': date,
    'timezoneOffset': timezoneOffsetMinutes(),
    'attemptId': attemptId,
    // The sentence the picks read as. Without it the server labels the meal
    // with the resolved names in resolution order, which puts every scanned
    // product after every relogged dish however they were typed.
    //
    // OMITTED when blank rather than sent empty: the server's `displayText` is
    // `.min(1)`, so an empty string 400s the whole stage — one blank label
    // costing the entire meal. Web's submit guards it the same way
    // (`displayText.length > 0 ? { displayText } : {}`).
    if (displayText != null && displayText.trim().isNotEmpty)
      'displayText': displayText,
  });
  // The stage COMMITTED the moment the POST returned. Nothing below may
  // surface as a staging failure: the caller would keep the picks, the user
  // would resubmit, and a fresh attempt id would stage a SECOND pending row —
  // two review cards for one meal. [settleAfterMealWrite] swallows the lot.
  await settleAfterMealWrite(
    ref.read,
    ref.invalidate,
    userId: userId,
    date: date,
    // The picks just gained an occurrence, which is what the candidate ranking
    // scores on — drop the cached searches so the next `/` reflects it. Passed
    // in rather than folded into `invalidateMealSurfaces` because that lives in
    // logging_providers, and importing this file from there would close an
    // import cycle for what is only a suggestion cache.
    //
    // The rest of `invalidateMealSurfaces` is deliberately NOT run here: a
    // stage writes a pending analysis, not a meal, so the dashboard, the
    // nutrition overview and the meal-dates dots have nothing new to show
    // until the user confirms the card.
    also: () => ref.invalidate(relogCandidatesProvider),
  );
}
