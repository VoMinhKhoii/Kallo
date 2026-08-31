import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../services/billing/feature_lock.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../data/feed_mutations.dart';
import 'feed_action_button.dart';

class FeedEntryActions extends ConsumerStatefulWidget {
  const FeedEntryActions({
    required this.entry,
    required this.onReply,
    super.key,
  });

  final CircleFeedEntry entry;

  /// Opens the reply composer. Reply lives in this row rather than under the
  /// replies list so that all three affordances read as one interaction
  /// system; [ShareReplies] owns the composer itself.
  final VoidCallback onReply;

  @override
  ConsumerState<FeedEntryActions> createState() => _FeedEntryActionsState();
}

class _FeedEntryActionsState extends ConsumerState<FeedEntryActions> {
  bool _toggling = false;
  bool _logging = false;

  Future<void> _toggle() async {
    if (_toggling) return;
    setState(() => _toggling = true);
    try {
      await toggleShareReaction(ref, widget.entry.meal.shareId);
    } catch (_) {
      if (mounted) {
        showTopToast(
          context,
          tr('groups.feed.reactionError'),
          variant: TopToastVariant.error,
        );
      }
    } finally {
      if (mounted) setState(() => _toggling = false);
    }
  }

  Future<void> _log() async {
    if (_logging) return;
    setState(() => _logging = true);
    try {
      await logSharedMeal(ref, widget.entry.meal.shareId);
      if (mounted) showTopToast(context, tr('groups.feed.logSuccess'));
    } catch (error) {
      // Pulling a copy off a friend's meal is the initiator side of copy/split
      // and is gated: send a 402 to the paywall rather than reporting it as a
      // failed log.
      if (mounted && !handledFeatureLock(context, error)) {
        showTopToast(
          context,
          tr('groups.feed.logError'),
          variant: TopToastVariant.error,
        );
      }
    } finally {
      if (mounted) setState(() => _logging = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reactions = widget.entry.reactions;
    // No leading inset on the first action: its 44pt box starts at the content
    // column and the glyph sits flush with the meal text above, which is what
    // the canvas' -12 left margin buys. The box still extends its full width
    // to the right, so nothing is taken off the target to get there.
    return Row(
      children: [
        Semantics(
          label: tr('groups.feed.heart'),
          button: true,
          toggled: reactions.mine,
          child: FeedActionButton(
            onTap: _toggling ? null : _toggle,
            icon: LucideIcons.heart300,
            fill: reactions.mine ? 1 : 0,
            label: '${reactions.count}',
            alignment: Alignment.centerLeft,
          ),
        ),
        FeedActionButton(
          onTap: widget.onReply,
          icon: LucideIcons.messageCircle300,
          semanticLabel: tr('groups.feed.reply'),
        ),
        if (!widget.entry.isSelf)
          FeedActionButton(
            onTap: _logging ? null : _log,
            icon: LucideIcons.copy300,
            label: tr('groups.feed.logCopy'),
          ),
      ],
    );
  }
}
