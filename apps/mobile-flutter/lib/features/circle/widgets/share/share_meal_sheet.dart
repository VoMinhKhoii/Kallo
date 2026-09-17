import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../logging/data/logging_models.dart';
import '../../data/circle_providers.dart';
import '../states/friend_list_skeleton.dart';
import 'share_meal_body.dart';
import 'share_meal_draft.dart';
import 'share_meal_request.dart';
import 'share_meal_states.dart';
import 'share_meal_footer.dart';

/// The sheet body. Opened through `showShareMealSheet`, which owns the
/// confirmation toast, the undo, and the send — all three outlive this widget,
/// so none of them can live here.
class ShareMealSheet extends ConsumerStatefulWidget {
  const ShareMealSheet({
    super.key,
    required this.meal,
    required this.onAddFriends,
  });

  final PersistedMeal meal;

  /// Closes this sheet and opens the add-friend flow. Owned by the opener:
  /// this sheet's context is gone the moment it pops.
  final VoidCallback onAddFriends;

  @override
  ConsumerState<ShareMealSheet> createState() => _ShareMealSheetState();
}

class _ShareMealSheetState extends ConsumerState<ShareMealSheet> {
  final _draft = ShareMealDraft();

  /// The lane holds its height so the footer never moves — not when the list
  /// is long, not when the tab changes.
  static const double _laneHeight = 150;

  double? get _totalKcal => widget.meal.nutrition.caloriesKcal;

  bool get _canSubmit => !_draft.isEmpty;

  void _submit() {
    if (!_canSubmit) return;
    final isSplit = _draft.isSplit;
    // Hand the share back unsent; the caller holds it for the undo window.
    Navigator.of(context).pop(
      ShareMealRequest(
        mealId: widget.meal.id,
        friendUserIds: _draft.seated.map((p) => p.userId).toList(),
        isSplit: isSplit,
        // ALWAYS send the parts for a split, even an untouched even one.
        //
        // Skipping them on "even" looked like a safe optimisation and was not:
        // 20 is not divisible by 3, so the meter draws an even three-way split
        // as 7/7/6 (35/35/30) while the server's no-parts path divides 20 by 3
        // exactly. The user confirmed one allocation and the database stored a
        // different one. Sending what the meter shows makes the two agree by
        // construction, and the two-person case is 10/10 either way.
        myParts: isSplit ? _draft.parts.first : null,
        splits: isSplit ? _draft.splitsPayload() : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets.bottom;
    final maxHeight = (MediaQuery.of(context).size.height - viewInsets) * 0.9;
    final friendsAsync = ref.watch(circleFriendsProvider);

    return KalloSheetSurface(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          KalloSheetHeader(
            title: tr('groups.shareMeal.title'),
            subtitle: widget.meal.rawInput,
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                KalloSpacing.sp4,
                KalloSpacing.sp2,
                KalloSpacing.sp4,
                0,
              ),
              child: friendsAsync.when(
                loading:
                    () => FriendListSkeleton(
                      semanticsLabel: tr('groups.shareMeal.loadingFriends'),
                    ),
                error:
                    (_, __) => ShareMealErrorState(
                      onRetry: () => ref.invalidate(circleFriendsProvider),
                    ),
                data: (members) {
                  final friends = members.where((m) => m.isAccepted).toList();
                  if (friends.isEmpty) {
                    return ShareMealEmptyState(
                      onAddFriends: widget.onAddFriends,
                    );
                  }
                  return ShareMealBody(
                    mode: _draft.mode,
                    seated: _draft.seated,
                    parts: _draft.parts,
                    totalKcal: _totalKcal,
                    friends: friends,
                    laneHeight: _laneHeight,
                    onModeChanged: (m) => setState(() => _draft.mode = m),
                    onPartsChanged: (p) => setState(() => _draft.parts = p),
                    onRemoveSeat:
                        (seat) => setState(() => _draft.removeSeat(seat)),
                    onSplitEvenly: () => setState(_draft.splitEvenly),
                    onAdd: (p) => setState(() => _draft.add(p)),
                  );
                },
              ),
            ),
          ),
          ShareMealFooter(
            seatedCount: _draft.seated.length,
            keptParts: _draft.keptParts,
            totalKcal: _totalKcal,
            canSubmit: _canSubmit,
            onSubmit: _submit,
            onCancel: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }
}
