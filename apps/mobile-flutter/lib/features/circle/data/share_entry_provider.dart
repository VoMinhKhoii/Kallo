/// Reading ONE Circle post by id, when no loaded feed holds it.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/social/circle.dart';
import '../../../services/http/api_client.dart';
import '../../../services/http/query.dart';

const Duration _shareRequestTimeout = Duration(seconds: 15);

/// One shared meal, fetched by share id — the thread page's FALLBACK source.
///
/// The feed cache stays the primary one (`threadEntryProvider` looks there
/// first) because it is what the optimistic writes in `feed_mutations.dart`
/// patch: a heart or a reply reaches the thread page on the same frame it
/// reaches the card behind it, with no second cache to keep honest. But that
/// cache only ever holds the pages the app has actually loaded, of the feed
/// the app happens to be looking at. A post older than page 1, or one shared
/// only into a chat group by someone the viewer is not friends with, is
/// simply not in it — and a share notification opens `/circle/<shareId>` with
/// no scope at all. Without this read those taps landed on "This post isn't
/// here any more" about a post that exists.
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
