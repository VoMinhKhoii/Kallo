import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../services/billing/feature_lock.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/circle_providers.dart';
import '../states/friend_list_skeleton.dart';
import '../groups/friend_pick_row.dart';
import 'share_meal_mode_selector.dart';
import 'share_meal_submit_button.dart';
import '../../../../theme/calm_tokens.dart';

/// Opens the "share this meal" sheet: pick a mode (full copy or even split) and
/// the friends who ate with you. Mirrors the web `ShareMealDialog`.
Future<void> showShareMealSheet(BuildContext context, String mealId) {
  return showNhamSheet<void>(
    context,
    isScrollControlled: true,
    builder: (_) => _ShareMealSheet(mealId: mealId),
  );
}

class _ShareMealSheet extends ConsumerStatefulWidget {
  const _ShareMealSheet({required this.mealId});

  final String mealId;

  @override
  ConsumerState<_ShareMealSheet> createState() => _ShareMealSheetState();
}

class _ShareMealSheetState extends ConsumerState<_ShareMealSheet> {
  String _mode = 'copy';
  final Set<String> _selected = <String>{};
  bool _submitting = false;

  void _toggle(String userId) {
    setState(() {
      if (!_selected.add(userId)) _selected.remove(userId);
    });
  }

  Future<void> _submit() async {
    if (_selected.isEmpty || _submitting) return;
    setState(() => _submitting = true);
    final count = _selected.length;
    try {
      await shareMealWithFriends(
        ref,
        mealId: widget.mealId,
        friendUserIds: _selected.toList(),
        mode: _mode,
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      showTopToast(
        context,
        (_mode == 'split'
                ? 'groups.shareMeal.splitSuccess'
                : 'groups.shareMeal.copySuccess')
            .plural(count, namedArgs: {'count': '$count'}),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _submitting = false);
      // Copy/split is gated on the INITIATOR: a 402 means "not entitled", not
      // a failed share. Server enforcement stays the only gate — this is
      // purely how the refusal is presented.
      if (handledFeatureLock(context, error)) return;
      showTopToast(
        context,
        tr('groups.shareMeal.error'),
        variant: TopToastVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    // `KalloSheetSurface` lifts the sheet clear of the keyboard, so the cap
    // comes off the height the keyboard leaves.
    final viewInsets = MediaQuery.of(context).viewInsets.bottom;
    final maxHeight = (MediaQuery.of(context).size.height - viewInsets) * 0.85;
    final friendsAsync = ref.watch(circleFriendsProvider);
    final count = _selected.length;
    final portion = count > 0 ? '1/${count + 1}' : '—';

    return KalloSheetSurface(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          KalloSheetHeader(title: tr('groups.shareMeal.title')),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                KalloSpacing.sp4,
                0,
                KalloSpacing.sp4,
                KalloSpacing.sp5,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tr('groups.shareMeal.description'),
                    style: dashMeta(),
                  ),
                  const SizedBox(height: KalloSpacing.sp4),
                  ShareMealModeSelector(
                    mode: _mode,
                    onChanged: (mode) => setState(() => _mode = mode),
                  ),
                  // Only once a friend is picked — no bare em-dash placeholder.
                  if (_mode == 'split' && _selected.isNotEmpty) ...[
                    const SizedBox(height: KalloSpacing.sp3),
                    Text(
                      tr(
                        'groups.shareMeal.splitPreview',
                        namedArgs: {'portion': portion},
                      ),
                      style: dashMeta(color: kInk, weight: FontWeight.w500),
                    ),
                  ],
                  const SizedBox(height: KalloSpacing.sp4),
                  friendsAsync.when(
                    loading: () => FriendListSkeleton(
                      semanticsLabel: tr('groups.shareMeal.loadingFriends'),
                    ),
                    error:
                        (_, __) => Text(
                          tr('groups.shareMeal.error'),
                          style: dashMeta(),
                        ),
                    data: (members) {
                      final friends =
                          members.where((m) => m.isAccepted).toList();
                      if (friends.isEmpty) {
                        return Text(
                          tr('groups.shareMeal.noFriends'),
                          style: dashMeta(),
                        );
                      }
                      return Column(
                        children: [
                          for (final m in friends) ...[
                            FriendPickRow(
                              profile: m.profile,
                              selected: _selected.contains(m.profile.userId),
                              onTap: () => _toggle(m.profile.userId),
                            ),
                            const SizedBox(height: KalloSpacing.sp1),
                          ],
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: KalloSpacing.sp4),
                  SubmitButton(
                    label:
                        count == 0
                            ? tr('groups.shareMeal.submitEmpty')
                            : 'groups.shareMeal.submit'.plural(
                              count,
                              namedArgs: {'count': '$count'},
                            ),
                    enabled: count > 0 && !_submitting,
                    loading: _submitting,
                    onTap: _submit,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
