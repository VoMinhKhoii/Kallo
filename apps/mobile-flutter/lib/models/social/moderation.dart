/// Circle moderation DTOs (App Store 1.2): what can be reported and why, the
/// blocked-people list, and the server's objectionable-text error code.
///
/// Mirrors `lib/api/contracts/social/moderation.ts` on the web — the enum wire
/// values below are exactly the ones that contract (and the `content_reports`
/// CHECK constraints) accept.
library;

import '../http/api_error.dart';
import 'circle.dart';

/// The server's locale-agnostic code for user text that hit the
/// objectionable-term filter (HTTP 422). Lowercase, like `feature_locked` —
/// it comes from `lib/core/errors/catalog.ts` `Errors.objectionableContent`.
/// Returned by share replies, chat messages, chat group names (create and
/// rename) and circle display names / handles. The client should keep the
/// draft and ask the person to edit it, not show a generic failure.
const String kObjectionableContentCode = 'objectionable_content';

/// Whether [error] is the server refusing text as objectionable.
bool isObjectionableContentError(Object error) =>
    error is ApiError && error.code == kObjectionableContentCode;

/// What a report points at. Each target is a uuid; a [profile] by user id.
enum ReportTargetKind {
  share('share'),
  reply('reply'),
  chatMessage('chat_message'),
  profile('profile'),
  chatGroup('chat_group');

  const ReportTargetKind(this.wire);

  /// The value `POST /api/v1/reports` expects in `targetKind`.
  final String wire;
}

/// Why something is being reported.
enum ReportReason {
  spam('spam'),
  harassment('harassment'),
  hate('hate'),
  sexual('sexual'),
  violence('violence'),
  selfHarm('self_harm'),
  other('other');

  const ReportReason(this.wire);

  /// The value `POST /api/v1/reports` expects in `reason`.
  final String wire;
}

/// Server cap on a report's optional note (characters, after trimming).
const int kReportNoteMaxLength = 500;

/// One person the viewer has blocked (`GET /api/v1/groups/friends/blocked`).
/// Only blocks the viewer placed are ever listed.
class BlockedCircleUser {
  const BlockedCircleUser({required this.profile, required this.blockedAt});

  final CircleProfile profile;

  /// When the block was placed.
  final DateTime blockedAt;

  factory BlockedCircleUser.fromJson(Map<String, dynamic> json) =>
      BlockedCircleUser(
        profile: CircleProfile.fromJson(
          json['profile'] as Map<String, dynamic>,
        ),
        blockedAt: DateTime.parse(json['blockedAt'] as String),
      );
}
