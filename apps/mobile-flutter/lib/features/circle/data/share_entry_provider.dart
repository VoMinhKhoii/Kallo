/// Reading ONE Circle post by id, when no loaded feed holds it.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/http/api_error.dart';
import '../../../models/social/circle.dart';
import '../../../services/http/api_client.dart';
import '../../../services/http/query.dart';

const Duration _shareRequestTimeout = Duration(seconds: 15);

/// One shared meal, fetched by share id — the thread page's FALLBACK source
/// (`thread_providers.dart` explains when it is reached).
///
/// Not patched optimistically. A heart or reply on a post read through this
/// provider waits for its POST and this provider's refetch (two round trips)
/// because the optimistic writes in `feed_mutations.dart` only reach feed
/// caches. If that lag has to go, lift the per-entry transforms out of
/// `SharedMealFeedNotifier` into pure functions and apply them here too — do
/// not add a second patch site.
///
/// Backed by `GET /api/v1/groups/shares/<shareId>` → `{ entry }`, the same
/// entry shape the feeds return (`app/api/v1/groups/shares/[shareId]/route.ts`).
///
/// Returns null on 404. The server answers 404 for a deleted share AND for one
/// the viewer may not see, deliberately — the endpoint must not become a
/// share-existence oracle — so both arrive here as "gone", which is the one
/// state the page shows for either. Every other failure is rethrown: a
/// transport blip must read as a retryable error, never as a headstone for a
/// post that is still there.
final sharedMealEntryProvider = FutureProvider.autoDispose
    .family<CircleFeedEntry?, String>((ref, shareId) async {
      final api = ref.watch(apiClientProvider);
      try {
        return await runWithRetry(() async {
          final json = await api
              .get<Map<String, dynamic>>(
                '/api/v1/groups/shares/${Uri.encodeComponent(shareId)}',
              )
              .timeout(_shareRequestTimeout);
          return CircleFeedEntry.fromJson(
            json['entry'] as Map<String, dynamic>,
          );
        });
      } on ApiError catch (error) {
        if (error.status == 404) return null;
        rethrow;
      }
    });
