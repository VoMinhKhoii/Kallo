import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../shared/widgets/surface/kallo_pressable.dart';
import '../../logic/circle_spacing.dart';
import 'feed_entry_actions.dart';
import 'feed_entry_identity.dart';
import 'feed_nutrition.dart';
import 'feed_rhythm.dart';

/// One shared meal: who and when, the meal itself, its calories and macro
/// composition, then the action row.
///
/// Stateless since 2026-09-07. It used to own a `_replyOpen` flag for the
/// inline composer that opened underneath it; replying is its own page now
/// (`screens/circle_thread_screen.dart`), so the widget owns no UI state and
/// the feed and the thread can both draw a post with the same code.
class FeedEntry extends StatelessWidget {
  const FeedEntry({
    required this.entry,
    required this.onReply,
    this.scope,
    this.onOpen,
    super.key,
  });

  final CircleFeedEntry entry;

  /// What the reply glyph does — pushing the thread with its composer focused
  /// in the feed, focusing the composer already on screen on the thread page.
  ///
  /// Required, and a callback rather than a hardcoded push: this widget draws
  /// a post and nothing else, so a post can never push a second copy of the
  /// thread it is already inside.
  final VoidCallback onReply;

  /// The feed this post was read from — carried into the reaction mutation so
  /// a heart lands in THAT feed's cache, and named by the caller in the thread
  /// URL it builds. The thread page prefers the same cache and falls back to
  /// the single-share endpoint for a post no loaded feed holds (see
  /// `data/thread_providers.dart`).
  final String? scope;

  /// Opens this post's thread — the whole post is that target in the feed
  /// (Threads). Null means the post is not a tap target at all: the thread
  /// page's own copy of it, which is already the thread.
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final meal = entry.meal;
    final name = entry.isSelf ? tr('groups.wall.you') : entry.friend.label;
    final sharedAt = DateTime.parse(meal.sharedAt);

    final Widget row = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // TOP-aligned: inside the day card the disc is an identity marker
        // beside the content column, not a second column of its own, so the
        // separator under the post starts where the text does. The size and the
        // rail it opens are one derivation in `logic/circle_spacing.dart`.
        ProfileAvatarDisc(profile: entry.friend, size: kPostAvatar),
        const SizedBox(width: KalloSpacing.sp3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              FeedEntryIdentity(meal: meal, name: name, sharedAt: sharedAt),
              const SizedBox(height: kFeedTight),
              // Meal text, calorie-share bar and macro legend are one block
              // now — the app-wide [MealBlock] anatomy, shared with Recent
              // meals and the logging card.
              FeedNutrition(meal: meal),
              // No gap: the action row's own tap slack supplies it.
              FeedEntryActions(entry: entry, scope: scope, onReply: onReply),
            ],
          ),
        ),
      ],
    );

    final open = onOpen;
    if (open == null) return row;

    // The WHOLE post opens its thread (Threads), not a "View thread" link:
    // the three glyphs are the post's only other targets and each wins the
    // arena over this one, so nothing inside it is shadowed. The wash is the
    // glyph's alone — [KalloPressable] keeps a nested press off its ancestors.
    //
    // `topLeft` and no padding: the pressable shrink-wraps, and the Row's
    // Expanded child already fills the column's finite width, so the target is
    // exactly the post's own box.
    //
    // ONE callback behind both the annotation and the target: the node a
    // screen reader announces has to be the node that navigates.
    //
    // The action goes on the ANNOTATED node. Without it the button trait and
    // the name sat here while the tap lived on the [KalloPressable]'s node
    // underneath: VoiceOver announced "Open thread, button" over a node it
    // could not activate, and read the node that DOES navigate out as raw
    // post text (2026-09-08).
    //
    // It also does what `explicitChildNodes` used to do here — two conflicting
    // tap actions cannot merge into one node, so the post's texts stay nodes
    // of their own rather than being absorbed into this label (dumped both
    // ways: identical trees). The exact-label finds in
    // `circle_feed_open_thread_test.dart` go red if that stops holding.
    return Semantics(
      button: true,
      label: tr('groups.feed.openThread'),
      onTap: open,
      child: KalloPressable(
        onTap: open,
        alignment: Alignment.topLeft,
        child: row,
      ),
    );
  }
}
