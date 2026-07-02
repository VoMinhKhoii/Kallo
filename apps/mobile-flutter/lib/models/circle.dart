/// DTOs for the Circle (social) surface — the mobile mirror of the web
/// `/api/v1/groups/*` response shapes.
///
/// Contract source of truth: `lib/actions/groups.ts` (the `PublicProfile`,
/// `CircleMember`, and `CircleFeedEntry` interfaces). Macro values arrive as
/// JSON numbers (Drizzle decimals are serialized numeric here), so they decode
/// as `double?` — null when a food has no data for that nutrient.
library;

import 'package:characters/characters.dart';

/// A person's public-facing circle identity. Never carries private profile data
/// (weight/TDEE) — only what a friend is allowed to see.
class CircleProfile {
  const CircleProfile({
    required this.userId,
    required this.handle,
    this.displayName,
    this.avatarSeed,
  });

  final String userId;
  final String handle;
  final String? displayName;
  final String? avatarSeed;

  /// How a person is labelled in a circle: their display name, else their
  /// handle (slug). Mirrors `labelFor()` in
  /// `components/groups/invite/profile-identity.tsx`.
  String get label {
    final name = displayName?.trim();
    return (name != null && name.isNotEmpty) ? name : handle;
  }

  /// The uppercase first character of [label], for the initials avatar.
  String get initial => label.isEmpty ? '·' : label.characters.first.toUpperCase();

  factory CircleProfile.fromJson(Map<String, dynamic> json) => CircleProfile(
        userId: json['userId'] as String,
        handle: json['handle'] as String? ?? '',
        displayName: json['displayName'] as String?,
        avatarSeed: json['avatarSeed'] as String?,
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
        profile:
            CircleProfile.fromJson(json['profile'] as Map<String, dynamic>),
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

  factory CircleFeedMeal.fromJson(Map<String, dynamic> json) => CircleFeedMeal(
        mealId: json['mealId'] as String,
        shareId: json['shareId'] as String? ?? '',
        rawInput: json['rawInput'] as String? ?? '',
        sharedAt: json['sharedAt'] as String? ?? '',
        caloriesKcal: (json['caloriesKcal'] as num?)?.toDouble(),
        proteinG: (json['proteinG'] as num?)?.toDouble(),
        carbohydrateG: (json['carbohydrateG'] as num?)?.toDouble(),
        fatG: (json['fatG'] as num?)?.toDouble(),
      );
}

/// One row of the ambient circle wall.
class CircleFeedEntry {
  const CircleFeedEntry({
    required this.friend,
    required this.isSelf,
    required this.meal,
  });

  final CircleProfile friend;

  /// True when this is the viewer's own shared meal (their own "table").
  final bool isSelf;
  final CircleFeedMeal meal;

  factory CircleFeedEntry.fromJson(Map<String, dynamic> json) => CircleFeedEntry(
        friend: CircleProfile.fromJson(json['friend'] as Map<String, dynamic>),
        isSelf: json['isSelf'] as bool? ?? false,
        meal: CircleFeedMeal.fromJson(json['meal'] as Map<String, dynamic>),
      );
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
