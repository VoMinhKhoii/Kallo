import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/dashboard/data/dashboard_cache.dart';
import 'package:kallo_mobile/models/social/circle.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/circle/circle_feed_test_support.dart';
import 'fixtures.dart';

final _session = Session(
  accessToken: 'synthetic-pose-token',
  tokenType: 'bearer',
  user: const User(
    id: 'pose-viewer',
    appMetadata: {},
    userMetadata: {},
    aud: 'authenticated',
    email: 'alex@example.invalid',
    createdAt: '2026-01-01T00:00:00Z',
    lastSignInAt: '2026-11-01T00:00:00Z',
  ),
);

/// No disk reads/writes or cache state shared between matrix cases.
class _MemoryDashboardCache extends DashboardCache {
  @override
  Future<Map<String, dynamic>?> takeOnce(
    String userId,
    String date,
    int tz,
  ) async => null;

  @override
  Future<void> save(
    String userId,
    String date,
    int tz,
    Map<String, dynamic> bundle,
  ) async {}
}

/// What stands between the production provider graph and the network: a fake
/// API, a signed-in (or signed-out) session, and nothing on disk.
///
/// Shared by the widget-test harness and by `sim_tour_main.dart`, the build
/// that puts the same fixtures on a real simulator.
List<Override> poseOverrides({
  required PoseFixtures fixtures,
  required FakeApiClient api,
  required bool signedIn,
}) => [
  apiClientProvider.overrideWithValue(api),
  dashboardCacheProvider.overrideWithValue(_MemoryDashboardCache()),
  // The ambient badge stream polls forever; retain the real paged feed,
  // but supply a finite badge snapshot so disposal cannot await a tick.
  circleFeedProvider.overrideWith(
    (_) => Stream.value(fixtures.posts.map(CircleFeedEntry.fromJson).toList()),
  ),
  authEventsProvider.overrideWithValue(const Stream<AuthState>.empty()),
  currentSessionReaderProvider.overrideWithValue(
    () => signedIn ? _session : null,
  ),
];
