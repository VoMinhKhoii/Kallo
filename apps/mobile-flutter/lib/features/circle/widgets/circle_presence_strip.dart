import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/circle.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../../dashboard/widgets/skeleton.dart';
import '../data/circle_providers.dart';

/// Warm, status-free disc tints. Sage is reserved for status, so members are
/// tinted across tan / taupe / stone only — deterministic from avatarSeed.
/// Mirrors `DISC_TINTS` in `components/groups/circle-presence-strip.tsx`.
const List<List<Color>> _discTints = [
  // tan: accent @35% → border @45%
  [Color(0x59C9A87C), Color(0x73E8D5B5)],
  // taupe: #b8a890 @40% → #9c8c78 @35%
  [Color(0x66B8A890), Color(0x599C8C78)],
  // stone: #cfc6ba @45% → #a9a193 @35%
  [Color(0x73CFC6BA), Color(0x59A9A193)],
];

/// Deterministic tint index from the avatar seed — replicates the web's
/// JS `hash = (hash * 31 + charCodeAt) | 0` signed-32-bit hash so the same
/// member gets the same tint on both platforms.
@visibleForTesting
int discTintIndex(String? seed, String handle) {
  final key = seed ?? handle;
  var hash = 0;
  for (final code in key.codeUnits) {
    hash = (hash * 31 + code).toSigned(32);
  }
  return hash.abs() % _discTints.length;
}

/// The presence strip: one warm initials-disc per circle member. Members who
/// shared something today are tinted; quiet members are a muted outline disc —
/// membership and today's participation become visible at a glance, no
/// sentence. Tapping a disc opens the member actions (Remove / Block).
/// Mirrors `CirclePresenceStrip` on web.
class CirclePresenceStrip extends ConsumerWidget {
  const CirclePresenceStrip({required this.sharedTodayUserIds, super.key});

  final Set<String> sharedTodayUserIds;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final friendsAsync = ref.watch(circleFriendsProvider);

    return friendsAsync.when(
      // Hold the strip's space with muted placeholders so the wall doesn't
      // jump when members pop in.
      loading: () => Semantics(
        label: tr('groups.wall.presenceLabel'),
        child: Padding(
          padding: const EdgeInsets.only(bottom: NhamSpacing.sp6),
          child: Shimmer(
            child: Row(
              children: [
                for (var i = 0; i < 3; i++) ...[
                  if (i > 0) const SizedBox(width: NhamSpacing.sp4),
                  const Column(
                    children: [
                      SkeletonCircle(size: 40),
                      SizedBox(height: NhamSpacing.sp1_5),
                      SkeletonBar(width: 40, height: 10),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
      // The wall's own error state covers a failed roster; stay quiet here.
      error: (_, __) => const SizedBox.shrink(),
      data: (members) {
        final accepted =
            members.where((m) => m.isAccepted).toList(growable: false);
        if (accepted.isEmpty) return const SizedBox.shrink();

        return Semantics(
          label: tr('groups.wall.presenceLabel'),
          child: Padding(
            padding: const EdgeInsets.only(bottom: NhamSpacing.sp6),
            child: Wrap(
              spacing: NhamSpacing.sp4,
              runSpacing: NhamSpacing.sp4,
              children: [
                for (final member in accepted)
                  _MemberDisc(
                    member: member,
                    sharedToday:
                        sharedTodayUserIds.contains(member.profile.userId),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _MemberDisc extends ConsumerStatefulWidget {
  const _MemberDisc({required this.member, required this.sharedToday});

  final CircleMember member;
  final bool sharedToday;

  @override
  ConsumerState<_MemberDisc> createState() => _MemberDiscState();
}

class _MemberDiscState extends ConsumerState<_MemberDisc> {
  bool _busy = false;

  Future<void> _openActions() async {
    HapticFeedback.selectionClick();
    final action = await showMemberActionsSheet(
      context,
      name: widget.member.profile.label,
      sharedToday: widget.sharedToday,
    );
    if (action == null || !mounted || _busy) return;

    setState(() => _busy = true);
    try {
      switch (action) {
        case MemberAction.remove:
          await removeCircleFriend(ref, widget.member.profile.userId);
          if (mounted) showTopToast(context, tr('groups.wall.removed'));
        case MemberAction.block:
          await blockCircleFriend(ref, widget.member.profile.userId);
          if (mounted) showTopToast(context, tr('groups.wall.blocked'));
      }
      // The strip re-renders from the invalidated roster; the disc disappears.
    } catch (_) {
      if (!mounted) return;
      showTopToast(context, tr('groups.wall.actionError'),
          variant: TopToastVariant.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = widget.member.profile;
    final tint =
        _discTints[discTintIndex(profile.avatarSeed, profile.handle)];
    final sharedToday = widget.sharedToday;

    return Semantics(
      button: true,
      label: tr('groups.wall.memberActions', namedArgs: {'name': profile.label}),
      child: GestureDetector(
        onTap: _busy ? null : _openActions,
        child: Opacity(
          // Quiet members read as a muted outline disc; busy dims briefly.
          opacity: _busy ? 0.5 : (sharedToday ? 1 : 0.6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: tint,
                  ),
                  border: Border.all(
                    color: sharedToday
                        ? NhamColors.accent40
                        : NhamColors.borderHalf,
                  ),
                ),
                child: Text(
                  profile.initial,
                  style: NhamTextStyles.sansBold(fontSize: NhamFontSize.sm)
                      .copyWith(color: NhamColors.btn),
                ),
              ),
              const SizedBox(height: NhamSpacing.sp1_5),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 72),
                child: Text(
                  profile.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: NhamTextStyles.sansRegular(
                    fontSize: NhamFontSize.eyebrow,
                  ).copyWith(color: NhamColors.textMuted),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// What a member-disc tap can do.
enum MemberAction { remove, block }

/// The member popover, as a Nham bottom sheet: a quiet participation hint,
/// then Remove and Block (danger). Returns the chosen action or null.
Future<MemberAction?> showMemberActionsSheet(
  BuildContext context, {
  required String name,
  required bool sharedToday,
}) {
  return showModalBottomSheet<MemberAction>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (context) {
      final bottomInset = MediaQuery.of(context).padding.bottom;
      return Container(
        decoration: const BoxDecoration(
          color: NhamColors.surface,
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(NhamRadii.xxl)),
        ),
        padding: EdgeInsets.fromLTRB(
          NhamSpacing.sp3,
          NhamSpacing.sp4,
          NhamSpacing.sp3,
          bottomInset + NhamSpacing.sp4,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: NhamSpacing.sp2,
                vertical: NhamSpacing.sp1,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: NhamTextStyles.sansSemiBold(
                      fontSize: NhamFontSize.sm,
                    ).copyWith(color: NhamColors.text),
                  ),
                  const SizedBox(height: NhamSpacing.sp0_5),
                  Text(
                    tr(sharedToday
                        ? 'groups.wall.sharedTodayHint'
                        : 'groups.wall.quietHint'),
                    style: NhamTextStyles.sansRegular(
                      fontSize: NhamFontSize.xxs,
                    ).copyWith(color: NhamColors.textMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(height: NhamSpacing.sp2),
            _ActionRow(
              icon: LucideIcons.userMinus,
              label: tr('groups.wall.remove'),
              color: NhamColors.text,
              onTap: () => Navigator.of(context).pop(MemberAction.remove),
            ),
            _ActionRow(
              icon: LucideIcons.ban,
              label: tr('groups.wall.block'),
              color: NhamColors.danger,
              onTap: () => Navigator.of(context).pop(MemberAction.block),
            ),
          ],
        ),
      );
    },
  );
}

class _ActionRow extends StatefulWidget {
  const _ActionRow({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  State<_ActionRow> createState() => _ActionRowState();
}

class _ActionRowState extends State<_ActionRow> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final danger = widget.color == NhamColors.danger;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () {
        HapticFeedback.selectionClick();
        widget.onTap();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 120),
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp2,
          vertical: NhamSpacing.sp3,
        ),
        decoration: BoxDecoration(
          color: _pressed
              ? (danger ? const Color(0x1AD37B69) : NhamColors.hover50)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
        ),
        child: Row(
          children: [
            Icon(widget.icon, size: 18, color: widget.color),
            const SizedBox(width: NhamSpacing.sp3),
            Text(
              widget.label,
              style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.detail)
                  .copyWith(color: widget.color),
            ),
          ],
        ),
      ),
    );
  }
}
