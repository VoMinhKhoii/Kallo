import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/circle_providers.dart';
import '../states/circle_error.dart';
import '../../../../theme/calm_tokens.dart';

/// Who is already in your circle, with a Remove beside each. Mirrors
/// `components/groups/invite/circle-list.tsx`.
class CircleListSection extends ConsumerWidget {
  const CircleListSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final friendsAsync = ref.watch(circleFriendsProvider);
    return friendsAsync.when(
      loading: () => const SizedBox.shrink(),
      error:
          (_, __) => CircleErrorCard(
            compact: true,
            onRetry: () => ref.invalidate(circleFriendsProvider),
          ),
      data: (members) {
        final circle = members.where((m) => m.isAccepted).toList();
        if (circle.isEmpty) {
          return Text(
            tr('groups.circle.empty'),
            style: dashMeta(),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Group label, mixed case: the uppercase eyebrow is retired as a
            // section header (calm_tokens.dart, dashEyebrow).
            Text(
              tr(
                'groups.circle.title',
                namedArgs: {'count': '${circle.length}'},
              ),
              style: kGroupLabel(),
            ),
            const SizedBox(height: KalloSpacing.sp2),
            for (final member in circle) ...[
              _MemberRow(member: member),
              const SizedBox(height: KalloSpacing.sp2),
            ],
          ],
        );
      },
    );
  }
}

class _MemberRow extends ConsumerStatefulWidget {
  const _MemberRow({required this.member});

  final CircleMember member;

  @override
  ConsumerState<_MemberRow> createState() => _MemberRowState();
}

class _MemberRowState extends ConsumerState<_MemberRow> {
  bool _removing = false;

  Future<void> _remove() async {
    if (_removing) return;
    setState(() => _removing = true);
    try {
      await removeCircleFriend(ref, widget.member.profile.userId);
      // The list re-renders from the invalidated provider; nothing else to do.
    } catch (_) {
      if (!mounted) return;
      setState(() => _removing = false);
      showTopToast(
        context,
        tr('groups.circle.removeError'),
        variant: TopToastVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = widget.member.profile;
    return Container(
      padding: const EdgeInsets.all(KalloSpacing.sp3),
      decoration: BoxDecoration(
        color: KalloColors.track,
        borderRadius: BorderRadius.circular(KalloRadii.containerLg),
        border: Border.all(color: KalloColors.borderSoft),
      ),
      child: Row(
        children: [
          ProfileAvatarDisc(profile: profile, size: 36),
          const SizedBox(width: KalloSpacing.sp3),
          Expanded(
            child: Text(
              profile.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: dashBody(),
            ),
          ),
          Opacity(
            opacity: _removing ? 0.55 : 1,
            child: GestureDetector(
              onTap: _removing ? null : _remove,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: KalloSpacing.sp2_5,
                  vertical: KalloSpacing.sp1_5,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(KalloRadii.md),
                  border: Border.all(color: KalloColors.borderSoft),
                ),
                child: Text(
                  tr('groups.circle.remove'),
                  style: dashMeta(),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
