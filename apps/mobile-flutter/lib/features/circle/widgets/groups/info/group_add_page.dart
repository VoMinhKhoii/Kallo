import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../models/social/chat_group.dart';
import '../../../../../models/social/circle.dart';
import '../../../../../services/billing/entitlement_state.dart';
import '../../../../../services/billing/feature_lock.dart';
import '../../../../../shared/widgets/badges/premium_chip.dart';
import '../../../../../shared/widgets/sheet/kallo_sheet_sub_header.dart';
import '../../../../../shared/widgets/sheet/sheet_capsule_button.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_shapes.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../data/circle_providers.dart';
import '../../../data/local_blocks.dart';
import '../../states/circle_error.dart';
import '../../states/friend_list_skeleton.dart';
import 'group_candidate_row.dart';
import 'group_search_field.dart';

/// The group sheet's second level: pick friends to add.
///
/// A page of its own rather than a search box inside the info page: adding
/// is a task with its own confirm, and the "Add (n)" capsule in the header is
/// where iOS puts that confirm. Growing a group is `unlimited_circle`, so on
/// a plan without it the capsule opens the paywall and the Premium marker
/// sits beside the list's label.
///
/// The search text and the picks live in the sheet ([search], [selected]):
/// `SheetPageSwap` rebuilds each page from scratch on every swap.
class GroupAddPage extends ConsumerWidget {
  const GroupAddPage({
    required this.group,
    required this.search,
    required this.selected,
    required this.busy,
    required this.onToggle,
    required this.onBack,
    required this.onAdd,
    super.key,
  });

  final ChatGroupDetail group;
  final TextEditingController search;
  final Set<String> selected;
  final bool busy;
  final ValueChanged<String> onToggle;
  final VoidCallback onBack;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gate = premiumGate(ref, PremiumFeature.unlimitedCircle);
    final count = selected.length;
    final memberIds = {for (final m in group.members) m.userId};
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KalloSheetSubHeader(
          title: tr('groups.info.addMembers'),
          onBack: onBack,
          trailing: SheetCapsuleButton(
            label:
                count == 0
                    ? tr('groups.info.addCta')
                    : tr(
                      'groups.info.addCount',
                      namedArgs: {'count': '$count'},
                    ),
            onTap: count == 0 ? null : gate.tap(context, busy ? null : onAdd),
          ),
        ),
        Flexible(
          child: SingleChildScrollView(
            physics: const ClampingScrollPhysics(),
            padding: EdgeInsets.fromLTRB(
              KalloSpacing.sp4,
              0,
              KalloSpacing.sp4,
              KalloSpacing.sp6 + MediaQuery.paddingOf(context).bottom,
            ),
            child: ref
                .watch(visibleCircleFriendsProvider)
                .when(
                  loading:
                      () => FriendListSkeleton(
                        semanticsLabel: tr('common.loading'),
                      ),
                  error:
                      (_, __) => CircleErrorCard(
                        compact: true,
                        onRetry: () => ref.invalidate(circleFriendsProvider),
                      ),
                  data:
                      (friends) => _body(
                        friends
                            .where(
                              (f) =>
                                  f.isAccepted &&
                                  !memberIds.contains(f.profile.userId),
                            )
                            .toList(),
                        gate.locked,
                      ),
                ),
          ),
        ),
      ],
    );
  }

  Widget _body(List<CircleMember> candidates, bool locked) {
    if (candidates.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(KalloSpacing.sp4),
        child: Text(
          tr('groups.info.everyoneIn'),
          textAlign: TextAlign.center,
          style: dashMeta(),
        ),
      );
    }
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: search,
      builder: (context, value, _) {
        final query = value.text.trim().toLowerCase();
        final filtered =
            candidates
                .where((f) => f.profile.label.toLowerCase().contains(query))
                .toList();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            GroupSearchField(controller: search),
            const SizedBox(height: KalloSpacing.sp5),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                KalloSpacing.sp4,
                0,
                KalloSpacing.sp4,
                KalloSpacing.sp1_5,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      tr('groups.info.candidatesHeading'),
                      style: kGroupLabel(),
                    ),
                  ),
                  if (locked) const PremiumChip(),
                ],
              ),
            ),
            if (filtered.isEmpty)
              Padding(
                padding: const EdgeInsets.all(KalloSpacing.sp4),
                child: Text(tr('groups.info.noMatches'), style: dashMeta()),
              )
            else
              Container(
                clipBehavior: Clip.antiAlias,
                decoration: ShapeDecoration(
                  color: kCardSurface,
                  shape: KalloShapes.squircle(KalloRadii.card),
                ),
                child: Column(
                  children: [
                    for (var i = 0; i < filtered.length; i++) ...[
                      if (i > 0)
                        Container(
                          height: 1,
                          margin: const EdgeInsets.only(left: 64),
                          color: kHairline,
                        ),
                      GroupCandidateRow(
                        profile: filtered[i].profile,
                        selected: selected.contains(filtered[i].profile.userId),
                        onTap: () => onToggle(filtered[i].profile.userId),
                      ),
                    ],
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}
