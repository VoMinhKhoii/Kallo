import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../services/billing/feature_lock.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../shared/widgets/icons/filled_heart.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../data/feed_mutations.dart';
import 'feed_action_button.dart';

class FeedEntryActions extends ConsumerStatefulWidget {
  const FeedEntryActions({
    required this.entry,
    required this.onReply,
    this.scope,
    super.key,
  });

  final CircleFeedEntry entry;

  /// The feed this post was read from, passed to the reaction mutation so the
  /// heart lands in THIS feed's cache even when the Circle tab has another
  /// one selected.
  final String? scope;

  /// Opens the reply composer. Reply lives in this row rather than under the
  /// replies list so that all three affordances read as one interaction
  /// system; the thread page's `ThreadComposer` owns the composer itself.
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
      await toggleShareReaction(
        ref,
        widget.entry.meal.shareId,
        scope: widget.scope,
      );
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
    //
    // A [Wrap], not a [Row]: the three targets are fixed-width boxes around
    // text ("Log this too", the counts), so at a large text scale on a narrow
    // screen they add up past the content column and a Row CLIPS the third
    // one — content that cannot be seen. Wrapping drops it to a second line
    // instead.
    //
    // Safe here only because [KalloPressable] shrink-wraps (see its *Sizing*
    // doc, 2026-09-08). It did not before: a Wrap offers its children the
    // COLUMN's width as a finite max, the pressable's Container-alignment
    // grew to it, and all three actions stacked one per line. A Row hid that
    // by offering unbounded width — so "a Wrap lays out identically to a Row"
    // was never true; it is true now because the child no longer takes the
    // width it is offered.
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Semantics(
          label: tr('groups.feed.heart'),
          button: true,
          toggled: reactions.mine,
          child: FeedActionButton(
            onTap: _toggling ? null : _toggle,
            icon: LucideIcons.heart300,
            active: reactions.mine,
            // Lucide is a FONT here, so `Icon(fill:)` never filled the heart
            // on the phone: the hearted state is its own SVG glyph.
            activeGlyph: const FilledHeart(),
            // The swipe-to-delete red, reused rather than minted: it is the
            // palette's one red, and a hearted post has to look hearted from
            // across the row. The count beside it stays on the action ink, so
            // the row keeps a single voice.
            activeColor: KalloColors.danger,
            label: '${reactions.count}',
            alignment: Alignment.centerLeft,
          ),
        ),
        FeedActionButton(
          onTap: widget.onReply,
          icon: LucideIcons.messageCircle300,
          semanticLabel: tr('groups.feed.reply'),
          // The count rides the glyph exactly as the heart's does — that IS
          // the reply count now that the card shows no replies under the
          // post. Zero prints nothing: an empty thread is the common case and
          // a "0" beside every bubble is noise, not information.
          label:
              widget.entry.repliesTotal > 0
                  ? '${widget.entry.repliesTotal}'
                  : null,
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
