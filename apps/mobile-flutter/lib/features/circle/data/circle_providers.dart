/// Riverpod providers for the Circle (social) surface.
///
/// These replace the web TanStack hooks (`use-circle-feed`, `use-friends`,
/// `use-invite`, `use-share-meal`) against the SAME `/api/v1/groups/*` REST
/// contract. The feed polls every 30s (Realtime deferred), mirroring the web
/// `refetchInterval`. Mutations are plain async helpers that invalidate the
/// affected providers, matching the dashboard's `logWeight` pattern.
library;

import 'dart:typed_data';

import 'package:flutter/widgets.dart' show AppLifecycleState, WidgetsBinding;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api_client.dart';
import '../../../data/query.dart';
import '../../../models/circle.dart';
import '../../dashboard/data/dashboard_providers.dart' show localTimezoneOffsetMinutes;
import '../../logging/data/logging_providers.dart' show loggingDayProvider;

/// How often the ambient wall re-polls for new shared meals (web parity).
const Duration kCirclePollInterval = Duration(seconds: 30);

/// A pending invite slug stashed when a signed-out user opens an invite link.
/// The router consumes it after sign-in to route back to the connect screen
/// (the app equivalent of the web invite page's `next` round-trip), so the
/// invite survives the auth detour instead of dropping the user on the dashboard.
final pendingInviteSlugProvider = StateProvider<String?>((ref) => null);

Future<List<CircleFeedEntry>> _fetchFeed(ApiClient api) => runWithRetry(() async {
      final tz = localTimezoneOffsetMinutes();
      // Timeout so a hung request can't block the initial load or wedge a
      // poll tick forever; TimeoutException is retryable per shouldRetryQuery.
      final json = await api
          .get<Map<String, dynamic>>('/api/v1/groups/feed?timezoneOffset=$tz')
          .timeout(const Duration(seconds: 15));
      final list = (json['feed'] as List<dynamic>?) ?? const [];
      return list
          .map((e) => CircleFeedEntry.fromJson(e as Map<String, dynamic>))
          .toList(growable: false);
    });

/// The ambient circle wall — one most-recent shared meal per friend, today.
///
/// Emits an initial load (errors surface so the wall can show its error state +
/// retry), then re-polls every [kCirclePollInterval]. Transient poll failures
/// after the first success are swallowed so a blip never blanks a loaded wall —
/// the last good frame stays until the next successful poll.
final circleFeedProvider =
    StreamProvider.autoDispose<List<CircleFeedEntry>>((ref) async* {
  final api = ref.watch(apiClientProvider);

  // First load: let errors propagate to the UI.
  yield await _fetchFeed(api);

  await for (final _ in Stream<void>.periodic(kCirclePollInterval)) {
    // Don't burn network/battery while the app is backgrounded — web parity:
    // TanStack pauses `refetchInterval` when the tab is hidden. The next tick
    // after resume picks the feed back up.
    final lifecycle = WidgetsBinding.instance.lifecycleState;
    if (lifecycle != null && lifecycle != AppLifecycleState.resumed) {
      continue;
    }
    try {
      yield await _fetchFeed(api);
    } on ApiError catch (error) {
      // A terminal error (401 expired session, 400, 404) must not hide behind
      // a stale wall forever — surface it so the UI shows retry. Retryable
      // server blips (5xx/429) keep the last good frame until the next tick.
      if (!error.retryable) rethrow;
    } catch (_) {
      // Network/transport blip — keep the last good frame.
    }
  }
});

/// The viewer's connections (accepted + pending), excluding blocked edges.
final circleFriendsProvider =
    FutureProvider.autoDispose<List<CircleMember>>((ref) async {
  final api = ref.watch(apiClientProvider);
  return runWithRetry(() async {
    final json = await api.get<Map<String, dynamic>>('/api/v1/groups/friends');
    final list = (json['circle'] as List<dynamic>?) ?? const [];
    return list
        .map((e) => CircleMember.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  });
});

/// The viewer's own public profile — auto-provisioned server-side, so the
/// invite link + handle are ready immediately (never null).
final myCircleProfileProvider =
    FutureProvider.autoDispose<CircleProfile>((ref) async {
  final api = ref.watch(apiClientProvider);
  return runWithRetry(() async {
    final json = await api.get<Map<String, dynamic>>('/api/v1/groups/profile');
    return CircleProfile.fromJson(json['profile'] as Map<String, dynamic>);
  });
});

/// Read-only preview of an invite link, keyed by the inviter's slug. Resolves
/// the inviter's identity + the viewer's relationship WITHOUT connecting — the
/// recipient still taps Accept. Backed by `GET /api/v1/groups/invite/<slug>`.
final invitePreviewProvider =
    FutureProvider.autoDispose.family<InvitePreview, String>((ref, slug) async {
  final api = ref.watch(apiClientProvider);
  // A bad slug is a 404 (non-retryable ApiError) — surfaces as the invalid state.
  final json = await api.get<Map<String, dynamic>>(
    '/api/v1/groups/invite/${Uri.encodeComponent(slug)}',
  );
  return InvitePreview.fromJson(json);
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/// Sentinel default for [saveCircleProfile]'s `displayName` — "don't touch it".
const Object _keepDisplayName = Object();

/// Save the viewer's editable link end (slug) and/or display name
/// (`POST /api/v1/groups/profile`). `displayName` is tri-state, matching the
/// server contract: leave it at the default to KEEP the stored name (slug-only
/// saves must not wipe it), pass `null` to CLEAR it, or a string to set it.
/// Invalidates the profile, friends, and feed (labels change) so every surface
/// reflects the new name. Returns the updated profile. Throws [ApiError]
/// (CONFLICT when the handle is taken).
Future<CircleProfile> saveCircleProfile(
  WidgetRef ref, {
  required String handle,
  Object? displayName = _keepDisplayName,
}) async {
  final api = ref.read(apiClientProvider);
  final body = <String, dynamic>{'handle': handle};
  if (!identical(displayName, _keepDisplayName)) {
    body['displayName'] = displayName as String?;
  }
  final json =
      await api.post<Map<String, dynamic>>('/api/v1/groups/profile', body);
  final profile = CircleProfile.fromJson(json['profile'] as Map<String, dynamic>);
  ref.invalidate(myCircleProfileProvider);
  ref.invalidate(circleFriendsProvider);
  ref.invalidate(circleFeedProvider);
  return profile;
}

/// Rename the viewer ("what should we call you") via
/// `POST /api/v1/groups/profile/name`. The invite handle is re-derived from
/// the name server-side, so outstanding invite links change. Invalidates the
/// same surfaces as [saveCircleProfile]. Returns the updated profile.
Future<CircleProfile> renameCircleProfile(
  WidgetRef ref,
  String displayName,
) async {
  final api = ref.read(apiClientProvider);
  final json = await api.post<Map<String, dynamic>>(
    '/api/v1/groups/profile/name',
    {'displayName': displayName},
  );
  final profile = CircleProfile.fromJson(json['profile'] as Map<String, dynamic>);
  ref.invalidate(myCircleProfileProvider);
  ref.invalidate(circleFriendsProvider);
  ref.invalidate(circleFeedProvider);
  return profile;
}

/// Upload a new avatar photo (`POST /api/v1/groups/profile/avatar`,
/// multipart). Invalidates every surface that renders the viewer's identity.
Future<CircleProfile> uploadCircleAvatar(
  WidgetRef ref, {
  required Uint8List bytes,
  required String filename,
  required String contentType,
}) async {
  final api = ref.read(apiClientProvider);
  final json = await api.uploadAvatar(
    bytes: bytes,
    filename: filename,
    contentType: contentType,
  );
  final profile = CircleProfile.fromJson(json);
  ref.invalidate(myCircleProfileProvider);
  ref.invalidate(circleFriendsProvider);
  ref.invalidate(circleFeedProvider);
  return profile;
}

/// Remove the avatar photo (`DELETE /api/v1/groups/profile/avatar`) — the UI
/// falls back to the initials disc.
Future<CircleProfile> removeCircleAvatar(WidgetRef ref) async {
  final api = ref.read(apiClientProvider);
  final json =
      await api.delete<Map<String, dynamic>>('/api/v1/groups/profile/avatar');
  final profile = CircleProfile.fromJson(json['profile'] as Map<String, dynamic>);
  ref.invalidate(myCircleProfileProvider);
  ref.invalidate(circleFriendsProvider);
  ref.invalidate(circleFeedProvider);
  return profile;
}

/// Accept an invite link (`POST /api/v1/groups/invite/accept`). Creates the
/// bilateral friendship, then invalidates friends + feed so every surface
/// reflects the new connection. Deliberately does NOT invalidate this slug's
/// [invitePreviewProvider]: the connect panel resolves the acceptance in place
/// (disc slides in, title crossfades), and a refetch flipping the relation to
/// `accepted` would swap the panel for the static "already connected" shell
/// mid-animation. The preview is autoDispose, so the next fresh mount of the
/// connect screen refetches the true state anyway. Returns the inviter.
Future<CircleProfile> acceptCircleInvite(WidgetRef ref, String slug) async {
  final api = ref.read(apiClientProvider);
  final json = await api.post<Map<String, dynamic>>(
    '/api/v1/groups/invite/accept',
    {'slug': slug},
  );
  final inviter = CircleProfile.fromJson(json['inviter'] as Map<String, dynamic>);
  ref.invalidate(circleFriendsProvider);
  ref.invalidate(circleFeedProvider);
  return inviter;
}

/// Remove a connection (`DELETE /api/v1/groups/friends/remove`). The pair can
/// re-invite later. Invalidates friends + feed. Throws [ApiError] on failure.
Future<void> removeCircleFriend(WidgetRef ref, String targetUserId) async {
  final api = ref.read(apiClientProvider);
  await api.delete<dynamic>('/api/v1/groups/friends/remove', {
    'targetUserId': targetUserId,
  });
  ref.invalidate(circleFriendsProvider);
  ref.invalidate(circleFeedProvider);
}

/// Block a user (`POST /api/v1/groups/friends/block`) — locks the edge so they
/// can't re-invite. Invalidates friends + feed. Throws [ApiError] on failure.
Future<void> blockCircleFriend(WidgetRef ref, String targetUserId) async {
  final api = ref.read(apiClientProvider);
  await api.post<dynamic>('/api/v1/groups/friends/block', {
    'targetUserId': targetUserId,
  });
  ref.invalidate(circleFriendsProvider);
  ref.invalidate(circleFeedProvider);
}

// ---------------------------------------------------------------------------
// Copy / split a meal between friends
// ---------------------------------------------------------------------------

/// Pending copy/split offers addressed to me (the Circle inbox). Mirrors the
/// web `useMealShareInvites` against `GET /api/v1/groups/invites`.
final mealShareInvitesProvider =
    FutureProvider.autoDispose<List<MealShareInvite>>((ref) async {
  final api = ref.watch(apiClientProvider);
  return runWithRetry(() async {
    final json = await api.get<Map<String, dynamic>>('/api/v1/groups/invites');
    final list = (json['invites'] as List<dynamic>?) ?? const [];
    return list
        .map((e) => MealShareInvite.fromJson(e as Map<String, dynamic>))
        .toList(growable: false);
  });
});

/// Local calendar date (YYYY-MM-DD) — the day an accepted meal is stamped.
String _todayLocalDate() {
  final now = DateTime.now();
  final mm = now.month.toString().padLeft(2, '0');
  final dd = now.day.toString().padLeft(2, '0');
  return '${now.year}-$mm-$dd';
}

/// Offer a saved meal to specific friends as a full copy or an even split
/// (`POST /api/v1/groups/meal-share`). A split rescales the logger's own meal
/// down to their share, so the day + wall are invalidated. Throws [ApiError].
Future<void> shareMealWithFriends(
  WidgetRef ref, {
  required String mealId,
  required List<String> friendUserIds,
  required String mode, // 'copy' | 'split'
}) async {
  final api = ref.read(apiClientProvider);
  await api.post<Map<String, dynamic>>('/api/v1/groups/meal-share', {
    'mealId': mealId,
    'friendUserIds': friendUserIds,
    'mode': mode,
  });
  ref.invalidate(loggingDayProvider);
  ref.invalidate(circleFeedProvider);
}

/// Accept an invite (`POST /api/v1/groups/invites/accept`) — the scaled meal
/// lands in today's diary. Invalidates the inbox, the day, and the wall.
Future<void> acceptMealShareInvite(WidgetRef ref, String inviteId) async {
  final api = ref.read(apiClientProvider);
  await api.post<Map<String, dynamic>>('/api/v1/groups/invites/accept', {
    'inviteId': inviteId,
    'loggedDate': _todayLocalDate(),
    'timezoneOffset': localTimezoneOffsetMinutes(),
  });
  ref.invalidate(mealShareInvitesProvider);
  ref.invalidate(loggingDayProvider);
  ref.invalidate(circleFeedProvider);
}

/// Dismiss an invite (`POST /api/v1/groups/invites/dismiss`).
Future<void> dismissMealShareInvite(WidgetRef ref, String inviteId) async {
  final api = ref.read(apiClientProvider);
  await api.post<dynamic>('/api/v1/groups/invites/dismiss', {
    'inviteId': inviteId,
  });
  ref.invalidate(mealShareInvitesProvider);
}

/// The result of toggling a meal's circle visibility.
typedef ShareResult = ({String visibility, String? shareId});

/// Toggle a saved meal's circle visibility (`POST /api/v1/groups/shares`).
/// Invalidates the wall so it reflects the change. The meal card holds its own
/// optimistic state for the button, so no day refetch is forced here.
Future<ShareResult> setMealShareVisibility(
  WidgetRef ref, {
  required String mealId,
  required String visibility, // 'circle' | 'private'
}) async {
  final api = ref.read(apiClientProvider);
  final json = await api.post<Map<String, dynamic>>('/api/v1/groups/shares', {
    'mealId': mealId,
    'visibility': visibility,
  });
  ref.invalidate(circleFeedProvider);
  return (
    visibility: json['visibility'] as String? ?? visibility,
    shareId: json['shareId'] as String?,
  );
}
