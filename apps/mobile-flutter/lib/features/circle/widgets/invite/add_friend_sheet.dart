import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/kallo_typography.dart';
import '../../data/circle_providers.dart';
import '../states/add_friend_skeleton.dart';
import '../states/circle_error.dart';
import 'circle_list.dart';
import 'display_name_row.dart';
import 'invite_link_row.dart';

/// Opens the invite surface: your shareable link (with an editable end), your
/// display name, and your circle. No username search, no requests — people
/// connect by opening your link and tapping Accept. Mirrors `AddFriendDialog`.
Future<void> showAddFriendSheet(BuildContext context) {
  return showNhamSheet<void>(
    context,
    isScrollControlled: true,
    builder: (_) => const _AddFriendSheet(),
  );
}

class _AddFriendSheet extends ConsumerWidget {
  const _AddFriendSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final viewInsets = MediaQuery.of(context).viewInsets.bottom;
    final maxHeight = MediaQuery.of(context).size.height * 0.85;

    return KalloSheetSurface(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          KalloSheetHeader(title: tr('groups.invite.title')),
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                KalloSpacing.sp4,
                0,
                KalloSpacing.sp4,
                viewInsets + KalloSpacing.sp5,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tr('groups.invite.description'),
                    style: KalloTextStyles.sansRegular(
                      fontSize: KalloFontSize.detail,
                      height: KalloLeading.relaxed,
                    ).copyWith(color: KalloColors.textMuted),
                  ),
                  const SizedBox(height: KalloSpacing.sp4),
                  const _ProfileSection(),
                  const SizedBox(height: KalloSpacing.sp5),
                  const CircleListSection(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Your own identity: how you appear, and the link you hand out.
class _ProfileSection extends ConsumerWidget {
  const _ProfileSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(myCircleProfileProvider);
    return profileAsync.when(
      loading: () => const AddFriendProfileSkeleton(),
      error:
          (_, __) => CircleErrorCard(
            onRetry: () => ref.invalidate(myCircleProfileProvider),
          ),
      data:
          (profile) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DisplayNameRow(profile: profile),
              const SizedBox(height: KalloSpacing.sp4),
              InviteLinkRow(profile: profile),
            ],
          ),
    );
  }
}
