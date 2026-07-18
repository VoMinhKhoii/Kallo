/// DTOs for the Circle (social) surface — the mobile mirror of the web
/// `/api/v1/groups/*` response shapes.
///
/// Contract source of truth: `lib/actions/groups.ts` (the `PublicProfile`,
/// `CircleMember`, and `CircleFeedEntry` interfaces). Macro values arrive as
/// JSON numbers or numeric strings, so they decode as `double?` — null when a
/// food has no data for that nutrient.
library;

import 'package:characters/characters.dart';

double? _asDouble(dynamic value) => switch (value) {
  num number => number.toDouble(),
  String text => double.tryParse(text),
  _ => null,
};

/// A person's public-facing circle identity. Never carries private profile data
/// (weight/TDEE) — only what a friend is allowed to see.
class CircleProfile {
  const CircleProfile({
    required this.userId,
    required this.handle,
    this.displayName,
    this.avatarSeed,
    this.avatarUrl,
  });

  final String userId;
  final String handle;
  final String? displayName;
  final String? avatarSeed;
  final String? avatarUrl;

  /// How a person is labelled in a circle: their display name, else their
  /// handle (slug). Mirrors `labelFor()` in
  /// `components/groups/invite/profile-identity.tsx`.
  String get label {
    final name = displayName?.trim();
    return (name != null && name.isNotEmpty) ? name : handle;
  }

  /// The uppercase first character of [label], for the initials avatar.
  String get initial =>
      label.isEmpty ? '·' : label.characters.first.toUpperCase();

  factory CircleProfile.fromJson(Map<String, dynamic> json) => CircleProfile(
    userId: json['userId'] as String,
    handle: json['handle'] as String? ?? '',
    displayName: json['displayName'] as String?,
    avatarSeed: json['avatarSeed'] as String?,
    avatarUrl: json['avatarUrl'] as String?,
  );
}

/// One connection edge from the viewer's perspective.
class CircleMember {
  const CircleMember({
    required this.friendshipId,
    required this.status,
    required this.profile,
    this.direction,
  });

  final String friendshipId;

  /// `'pending' | 'accepted' | 'blocked'`.
  final String status;

  /// For pending edges: `'incoming' | 'outgoing'`, else null.
  final String? direction;
  final CircleProfile profile;

  bool get isAccepted => status == 'accepted';

  factory CircleMember.fromJson(Map<String, dynamic> json) => CircleMember(
    friendshipId: json['friendshipId'] as String,
    status: json['status'] as String? ?? 'pending',
    direction: json['direction'] as String?,
    profile: CircleProfile.fromJson(json['profile'] as Map<String, dynamic>),
  );
}

/// A friend's most-recent shared meal for today — one entry per friend.
class CircleFeedMeal {
  const CircleFeedMeal({
    required this.mealId,
    required this.shareId,
    required this.rawInput,
    required this.sharedAt,
    this.caloriesKcal,
    this.proteinG,
    this.carbohydrateG,
    this.fatG,
    this.portionFactor = 1,
  });

  final String mealId;
  final String shareId;
  final String rawInput;

  /// ISO-8601 timestamp of when the meal was shared.
  final String sharedAt;

  final double? caloriesKcal;
  final double? proteinG;
  final double? carbohydrateG;
  final double? fatG;
  final double portionFactor;

  factory CircleFeedMeal.fromJson(Map<String, dynamic> json) => CircleFeedMeal(
    mealId: json['mealId'] as String,
    shareId: json['shareId'] as String? ?? '',
    rawInput: json['rawInput'] as String? ?? '',
    sharedAt: json['sharedAt'] as String? ?? '',
    caloriesKcal: _asDouble(json['caloriesKcal']),
    proteinG: _asDouble(json['proteinG']),
    carbohydrateG: _asDouble(json['carbohydrateG']),
    fatG: _asDouble(json['fatG']),
    portionFactor: _asDouble(json['portionFactor']) ?? 1,
  );
}

/// Reaction summary for one shared meal.
class ShareReactions {
  const ShareReactions({this.count = 0, this.mine = false});

  final int count;
  final bool mine;

  factory ShareReactions.fromJson(Map<String, dynamic> json) => ShareReactions(
    count: (json['count'] as num?)?.toInt() ?? 0,
    mine: json['mine'] as bool? ?? false,
  );
}

/// One enriched reply attached to a shared meal.
class ShareReply {
  const ShareReply({
    required this.id,
    required this.author,
    required this.isSelf,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final CircleProfile author;
  final bool isSelf;
  final String body;
  final DateTime createdAt;

  factory ShareReply.fromJson(Map<String, dynamic> json) => ShareReply(
    id: json['id'] as String,
    author: CircleProfile.fromJson(json['author'] as Map<String, dynamic>),
    isSelf: json['isSelf'] as bool? ?? false,
    body: json['body'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
  );
}

/// One row of the ambient circle wall.
class CircleFeedEntry {
  const CircleFeedEntry({
    required this.friend,
    required this.isSelf,
    required this.meal,
    this.reactions = const ShareReactions(),
    this.replies = const [],
    this.repliesTotal = 0,
  });

  final CircleProfile friend;

  /// True when this is the viewer's own shared meal (their own "table").
  final bool isSelf;
  final CircleFeedMeal meal;
  final ShareReactions reactions;
  final List<ShareReply> replies;
  final int repliesTotal;

  factory CircleFeedEntry.fromJson(Map<String, dynamic> json) {
    final reactions = json['reactions'] as Map<String, dynamic>?;
    final replies = json['replies'] as List<dynamic>?;
    return CircleFeedEntry(
      friend: CircleProfile.fromJson(json['friend'] as Map<String, dynamic>),
      isSelf: json['isSelf'] as bool? ?? false,
      meal: CircleFeedMeal.fromJson(json['meal'] as Map<String, dynamic>),
      reactions: reactions == null
          ? const ShareReactions()
          : ShareReactions.fromJson(reactions),
      replies:
          replies
              ?.map(
                (reply) => ShareReply.fromJson(reply as Map<String, dynamic>),
              )
              .toList() ??
          const [],
      repliesTotal: (json['repliesTotal'] as num?)?.toInt() ?? 0,
    );
  }
}

/// One seek-paginated page of shared meals. [nextCursor] is opaque and null
/// when the thread history is exhausted.
class SharedMealFeedPage {
  const SharedMealFeedPage({required this.entries, this.nextCursor});

  final List<CircleFeedEntry> entries;
  final String? nextCursor;

  factory SharedMealFeedPage.fromJson(Map<String, dynamic> json) =>
      SharedMealFeedPage(
        entries: ((json['entries'] as List<dynamic>?) ?? const [])
            .map(
              (entry) =>
                  CircleFeedEntry.fromJson(entry as Map<String, dynamic>),
            )
            .toList(),
        nextCursor: json['nextCursor'] as String?,
      );
}

/// A pending copy/split offer addressed to the viewer — the Circle inbox item.
/// Contract source: `MealShareInvite` in `lib/actions/meal-sharing.ts`. The
/// macros are the portion the recipient will receive (already the sender's share
/// for a split — the source meal was scaled down when it was shared).
class MealShareInvite {
  const MealShareInvite({
    required this.id,
    required this.mode,
    required this.portionFactor,
    required this.from,
    required this.rawInput,
    this.caloriesKcal,
    this.proteinG,
    this.carbohydrateG,
    this.fatG,
  });

  final String id;

  /// `'copy' | 'split'`.
  final String mode;

  /// Fraction of the original the recipient gets (1 copy, 1/(N+1) split).
  final double portionFactor;
  final CircleProfile from;
  final String rawInput;
  final double? caloriesKcal;
  final double? proteinG;
  final double? carbohydrateG;
  final double? fatG;

  bool get isSplit => mode == 'split';

  factory MealShareInvite.fromJson(Map<String, dynamic> json) {
    final meal = (json['meal'] as Map<String, dynamic>?) ?? const {};
    return MealShareInvite(
      id: json['id'] as String,
      mode: json['mode'] as String? ?? 'copy',
      portionFactor: _asDouble(json['portionFactor']) ?? 1,
      from: CircleProfile.fromJson(json['from'] as Map<String, dynamic>),
      rawInput: meal['rawInput'] as String? ?? '',
      caloriesKcal: _asDouble(meal['caloriesKcal']),
      proteinG: _asDouble(meal['proteinG']),
      carbohydrateG: _asDouble(meal['carbohydrateG']),
      fatG: _asDouble(meal['fatG']),
    );
  }
}

/// The relationship between the viewer and an invite's inviter, resolved by the
/// preview endpoint (`GET /api/v1/groups/invite/<slug>`) without mutating.
enum InviteRelation { none, accepted, blocked, self }

InviteRelation _relationFrom(String? raw) => switch (raw) {
  'self' => InviteRelation.self,
  'accepted' => InviteRelation.accepted,
  'blocked' => InviteRelation.blocked,
  _ => InviteRelation.none,
};

/// Preview of an invite link — the inviter's identity plus how the viewer
/// already relates to them (drives the connect screen's state).
class InvitePreview {
  const InvitePreview({
    required this.inviter,
    required this.relation,
    required this.signedOut,
  });

  final CircleProfile inviter;
  final InviteRelation relation;

  /// True when no viewer is authenticated — the connect screen shows the
  /// "sign in to connect" CTA instead of Accept.
  final bool signedOut;

  factory InvitePreview.fromJson(Map<String, dynamic> json) => InvitePreview(
    inviter: CircleProfile.fromJson(json['inviter'] as Map<String, dynamic>),
    relation: _relationFrom(json['status'] as String?),
    signedOut: json['signedOut'] as bool? ?? false,
  );
}
