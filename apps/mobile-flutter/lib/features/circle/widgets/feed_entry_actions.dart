import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/circle.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/calm_tokens.dart';
import '../data/feed_mutations.dart';

class FeedEntryActions extends ConsumerStatefulWidget {
  const FeedEntryActions({required this.entry, super.key});

  final CircleFeedEntry entry;

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
        if (!widget.entry.isSelf) ...[
          const SizedBox(width: 18),
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
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 15,
              color: fill == 1 ? kInk : kInkMuted,
              fill: fill,
            ),
            const SizedBox(width: 6),
            Text(label, style: dashMeta()),
          ],
        ),
      ),
    ),
  );
}
