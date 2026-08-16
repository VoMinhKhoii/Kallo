import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/kallo_sheet.dart';
import '../../../shared/widgets/kallo_sheet_header.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';
import '../data/circle_providers.dart';
import 'friend_list_skeleton.dart';
import 'friend_pick_row.dart';
import 'share_meal_mode_selector.dart';
import 'share_meal_submit_button.dart';

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
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      showTopToast(
        context,
        tr('groups.shareMeal.error'),
        variant: TopToastVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets.bottom;
    final maxHeight = MediaQuery.of(context).size.height * 0.85;
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
                    tr('groups.shareMeal.description'),
                    style: KalloTextStyles.sansRegular(
                      fontSize: KalloFontSize.detail,
                      height: KalloLeading.relaxed,
                    ).copyWith(color: KalloColors.textMuted),
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
                      style: KalloTextStyles.sansMedium(
                        fontSize: KalloFontSize.xs,
                      ).copyWith(color: KalloColors.text),
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
                          style: KalloTextStyles.sansRegular(
                            fontSize: KalloFontSize.detail,
                          ).copyWith(color: KalloColors.textMuted),
                        ),
                    data: (members) {
                      final friends =
                          members.where((m) => m.isAccepted).toList();
                      if (friends.isEmpty) {
                        return Text(
                          tr('groups.shareMeal.noFriends'),
                          style: KalloTextStyles.sansRegular(
                            fontSize: KalloFontSize.detail,
                          ).copyWith(color: KalloColors.textMuted),
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
