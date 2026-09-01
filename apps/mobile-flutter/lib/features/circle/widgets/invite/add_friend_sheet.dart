import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/circle_providers.dart';
import '../states/add_friend_skeleton.dart';
import '../states/circle_error.dart';
import 'circle_list.dart';
import 'display_name_row.dart';
import 'invite_link_row.dart';

/// Opens the invite surface: your shareable link (with an editable end), your
/// display name, and your circle. No username search, no requests — people
/// connect by opening your link and tapping Accept.
Future<void> showAddFriendSheet(BuildContext context) {
  return showNhamSheet<void>(
    context,
    isScrollControlled: true,
    builder: (_) => const _AddFriendSheet(),
  );
}

/// Unified sheet chrome over two 64pt identity rows, the explainer, and the
/// beige "Share link" primary (native pass, 2026-08-31). Copy stays on the
/// link row's own glyph — Share hands the link to the OS sheet, which is how
/// an invite actually reaches someone.
class _AddFriendSheet extends ConsumerWidget {
  const _AddFriendSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final viewInsets = MediaQuery.of(context).viewInsets.bottom;
    final bottomInset = MediaQuery.viewPaddingOf(context).bottom;
    // `KalloSheetSurface` lifts the sheet clear of the keyboard, so the cap
    // comes off the height the keyboard leaves.
    final maxHeight = (MediaQuery.of(context).size.height - viewInsets) * 0.85;

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
                viewInsets > 0
                    ? KalloSpacing.sp3
                    : math.max(bottomInset, KalloSpacing.sp4),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _ProfileSection(),
                  SizedBox(height: KalloSpacing.sp4),
                  CircleListSection(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Your own identity: how you appear, the link you hand out, and Share.
class _ProfileSection extends ConsumerWidget {
  const _ProfileSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(myCircleProfileProvider);
    return profileAsync.when(
      loading: () => const AddFriendProfileSkeleton(),
      error: (_, __) => CircleErrorCard(
        onRetry: () => ref.invalidate(myCircleProfileProvider),
      ),
      data: (profile) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DisplayNameRow(profile: profile),
          const _RowSeparator(),
          InviteLinkRow(profile: profile),
          const SizedBox(height: KalloSpacing.sp2),
          Text(tr('groups.invite.description'), style: dashMeta()),
          const SizedBox(height: KalloSpacing.sp3),
          KalloButton(
            title: tr('groups.invite.shareLink'),
            onPressed: () => Share.share(inviteLinkFor(context, profile.handle)),
          ),
        ],
      ),
    );
  }
}

class _RowSeparator extends StatelessWidget {
  const _RowSeparator();

  @override
  Widget build(BuildContext context) =>
      const ColoredBox(color: kHairline, child: SizedBox(height: 1));
}
