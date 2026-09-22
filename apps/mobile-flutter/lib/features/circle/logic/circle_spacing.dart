/// Circle's geometry: the avatar tiers, and everything measured from them.
///
/// The sizes were inline literals in five places until 2026-09-22, and
/// [kContentRail] was a hand-computed `36 + 12` written as the bare `48` with
/// the arithmetic only in prose. Stepping the post's disc one size up therefore
/// meant editing a second file from memory — exactly the edit that gets missed,
/// and it would have left the feed's separators and its skeleton on the old
/// rail.
library;

import '../../../theme/kallo_theme.dart';

/// The post author's disc. Stepped 32 → 36 on 2026-09-22: the author is the one
/// face on the card that has to read as the person who ate this, and at 32 it
/// measured the same as the replies answering it.
const double kPostAvatar = 36;

/// A reply's disc, and the viewer's own in the composer — one step under the
/// post's, so the two tiers are told apart by size as well as by the card.
const double kReplyAvatar = 28;

/// [kPostAvatar] + its gap: where a post's content column starts. Everything
/// that has to line up with that column measures from here — the separator
/// between two posts and the skeleton's separator.
///
/// NOT the thread page's replies: a reply lines its avatar up with the POST's
/// avatar, so it measures from the card's own content inset
/// (`GroupedListCard.contentInset`) rather than from this rail.
const double kContentRail = kPostAvatar + KalloSpacing.sp3;

/// The uniform inset from the reply pill's stroke to everything inside it — the
/// gap the eye reads as the field's padding, the same on all four sides, and
/// the same step the send button beside the pill is spaced by, so the two read
/// as one gap rather than two decisions.
const double kReplyDockGap = KalloSpacing.sp2;

/// The reply dock's resting height: the viewer's disc plus that inset on both
/// sides. The send button reads THIS rather than restating the sum, so "the
/// button stands as tall as the field it sends" holds by construction instead
/// of by an assertion in someone's `build`.
///
/// It comes to [KalloIcons.hit] today, which is what lets the button's visual
/// be its own tap target with no slack left over to read as extra gap.
/// `test/features/circle/circle_thread_composer_send_test.dart` holds it there.
const double kReplyDockHeight = kReplyAvatar + 2 * kReplyDockGap;
