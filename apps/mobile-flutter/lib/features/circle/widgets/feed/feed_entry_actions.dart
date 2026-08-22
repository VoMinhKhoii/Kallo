import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../data/feed_mutations.dart';

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
    } catch (_) {
      if (mounted) {
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
    return Row(
      children: [
        Semantics(
          label: tr('groups.feed.heart'),
          button: true,
          toggled: reactions.mine,
          child: _Action(
            onTap: _toggling ? null : _toggle,
            icon: LucideIcons.heart300,
            fill: reactions.mine ? 1 : 0,
            label: '${reactions.count}',
          ),
        ),
        const SizedBox(width: _gap),
        _Action(
          onTap: widget.onReply,
          icon: LucideIcons.messageCircle300,
          label: tr('groups.feed.reply'),
        ),
        if (!widget.entry.isSelf) ...[
          const SizedBox(width: _gap),
          _Action(
            onTap: _logging ? null : _log,
            icon: LucideIcons.copy300,
            label: tr('groups.feed.logCopy'),
          ),
        ],
      ],
    );
  }
}

/// Horizontal gap between actions. The rows' 44pt hit boxes do not overlap, so
/// this is pure visual spacing.
const double _gap = 18;

/// Glyph size, and the minimum square the tap target must fill. The glyph sits
/// at the in-text-run size (a chip/meta-row exception to the app-wide 24), but
/// the touch box still has to clear 44.
const double _glyph = 16;
const double _hit = 44;

/// Actions sit one step darker than the calm secondary.
///
/// `calm_tokens.dart` holds the app to two text colours, and this is a
/// deliberate exception to it: at [kInkMuted] a 1.5-stroke glyph on the bright
/// canvas read as an affordance that had been switched off — and this row
/// already dims to 50% to mean exactly that, so the enabled and disabled states
/// were separated by very little. Data stays on the two-colour rule; controls
/// need to look pressable.
const Color _actionInk = KalloColors.textSoft;

class _Action extends StatelessWidget {
  const _Action({
    this.onTap,
    required this.icon,
    required this.label,
    this.fill,
  });

  final VoidCallback? onTap;
  final IconData icon;
  final String label;
  final double? fill;

  @override
  Widget build(BuildContext context) => Opacity(
    opacity: onTap == null ? 0.5 : 1,
    child: InkWell(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: _hit),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: _glyph,
              color: fill == 1 ? kInk : _actionInk,
              fill: fill,
            ),
            const SizedBox(width: 6),
            Text(label, style: dashMeta(color: _actionInk)),
          ],
        ),
      ),
    ),
  );
}
