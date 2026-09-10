import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../services/billing/feature_lock.dart';
import '../../../../shared/widgets/icons/filled_heart.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/kallo_theme.dart';
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
  /// Guard ONLY — never read in `build`, so it is mutated plainly rather than
  /// through `setState`. The heart stays lit and enabled for the whole round
  /// trip (the dim read as the like failing), so there is nothing on screen
  /// for a rebuild to change; two `setState`s per tap rebuilt the whole action
  /// row for no visual difference.
  bool _toggling = false;

  /// Read in `build` — "Log this too" DOES go disabled while it runs, so this
  /// one owes its rebuilds. The asymmetry with [_toggling] is the point.
  bool _logging = false;

  /// Hearts the post. The heart is never DISABLED while this runs (see the
  /// button below): this guard is the whole debounce, so a second tap
  /// mid-request is dropped here rather than by dimming the control.
  Future<void> _toggle() async {
    if (_toggling) return;
    // After the guard, not before: a tap that is being swallowed should not
    // buzz as though it landed. The tick is the only instant confirmation the
    // heart's own state change does not already give.
    HapticFeedback.lightImpact();
    _toggling = true;
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
      _toggling = false;
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
        FeedActionButton(
          // NEVER `_toggling ? null : _toggle`. The like is already optimistic
          // (`toggleReactionLocal` runs before the request), so disabling the
          // button turned the heart red and instantly greyed it — [Opacity] at
          // 0.5 for the whole round trip, up to the 15s mutation timeout —
          // then snapped it back. `_toggle`'s own `_toggling` guard debounces
          // the second tap, so nothing is lost by staying enabled, and an
          // enabled pressable still enters the gesture arena and claims its
          // pointer (`kallo_pressable.dart`, *Nesting*) rather than letting a
          // double tap fall through to the post underneath.
          onTap: _toggle,
          icon: LucideIcons.heart300,
          // Lucide is a FONT here, so `Icon(fill:)` never filled the heart on
          // the phone: the hearted state is its own SVG glyph, painted in the
          // swipe-to-delete red so a hearted post looks hearted from across
          // the row. Same 20 as the outline, or the post would twitch a size
          // as it is hearted.
          // The SAME optical size the outline resolves to, read from the same
          // table, or the post twitches a size as it is hearted.
          activeGlyph: reactions.mine
              ? FilledHeart(size: KalloIcons.optical(LucideIcons.heart300))
              : null,
          // The name is SPOKEN — the visible text beside the glyph is a bare
          // count — and the state rides the same node, so the heart announces
          // as one "Heart, 2, button" that is on or off.
          semanticLabel: tr('groups.feed.heart'),
          toggled: reactions.mine,
          // Zero prints nothing, exactly as the reply glyph's count does: an
          // unhearted post carried a literal "0" beside the outline, so a
          // fresh post opened reading "0" and "no replies" as its two loudest
          // characters. The spoken name still says "Heart".
          label: reactions.count > 0 ? '${reactions.count}' : null,
          alignment: Alignment.centerLeft,
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
