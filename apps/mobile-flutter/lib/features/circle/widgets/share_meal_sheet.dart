import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/top_toast.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/circle_providers.dart';
import 'circle_avatar.dart';

/// Opens the "share this meal" sheet: pick a mode (full copy or even split) and
/// the friends who ate with you. Mirrors the web `ShareMealDialog`.
Future<void> showShareMealSheet(BuildContext context, String mealId) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
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

    return Container(
      constraints: BoxConstraints(maxHeight: maxHeight),
      decoration: const BoxDecoration(
        color: NhamColors.surface,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(NhamRadii.xxl),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              NhamSpacing.sp2,
              NhamSpacing.sp2,
              NhamSpacing.sp2,
              NhamSpacing.sp1,
            ),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(LucideIcons.x, size: 22),
                  color: NhamColors.textMuted,
                  tooltip: tr('groups.invite.cancel'),
                ),
                Expanded(
                  child: Center(
                    child: Text(
                      tr('groups.shareMeal.title'),
                      style: NhamTextStyles.serifRegular(
                        fontSize: NhamFontSize.h4,
                      ).copyWith(color: NhamColors.text),
                    ),
                  ),
                ),
                const SizedBox(width: 48, height: 48),
              ],
            ),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                NhamSpacing.sp4,
                0,
                NhamSpacing.sp4,
                viewInsets + NhamSpacing.sp5,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tr('groups.shareMeal.description'),
                    style: NhamTextStyles.sansRegular(
                      fontSize: NhamFontSize.detail,
                      height: NhamLeading.relaxed,
                    ).copyWith(color: NhamColors.textMuted),
                  ),
                  const SizedBox(height: NhamSpacing.sp4),
                  Row(
                    children: [
                      Expanded(
                        child: _ModeCard(
                          label: tr('groups.shareMeal.mode.copy.label'),
                          hint: tr('groups.shareMeal.mode.copy.hint'),
                          selected: _mode == 'copy',
                          onTap: () => setState(() => _mode = 'copy'),
                        ),
                      ),
                      const SizedBox(width: NhamSpacing.sp2),
                      Expanded(
                        child: _ModeCard(
                          label: tr('groups.shareMeal.mode.split.label'),
                          hint: tr('groups.shareMeal.mode.split.hint'),
                          selected: _mode == 'split',
                          onTap: () => setState(() => _mode = 'split'),
                        ),
                      ),
                    ],
                  ),
                  // Only once a friend is picked — no bare em-dash placeholder.
                  if (_mode == 'split' && _selected.isNotEmpty) ...[
                    const SizedBox(height: NhamSpacing.sp3),
                    Text(
                      tr(
                        'groups.shareMeal.splitPreview',
                        namedArgs: {'portion': portion},
                      ),
                      style: NhamTextStyles.sansMedium(
                        fontSize: NhamFontSize.xs,
                      ).copyWith(color: NhamColors.text),
                    ),
                  ],
                  const SizedBox(height: NhamSpacing.sp4),
                  friendsAsync.when(
                    loading:
                        () => Text(
                          tr('groups.shareMeal.loadingFriends'),
                          style: NhamTextStyles.sansRegular(
                            fontSize: NhamFontSize.detail,
                          ).copyWith(color: NhamColors.textMuted),
                        ),
                    error:
                        (_, __) => Text(
                          tr('groups.shareMeal.error'),
                          style: NhamTextStyles.sansRegular(
                            fontSize: NhamFontSize.detail,
                          ).copyWith(color: NhamColors.textMuted),
                        ),
                    data: (members) {
                      final friends =
                          members.where((m) => m.isAccepted).toList();
                      if (friends.isEmpty) {
                        return Text(
                          tr('groups.shareMeal.noFriends'),
                          style: NhamTextStyles.sansRegular(
                            fontSize: NhamFontSize.detail,
                          ).copyWith(color: NhamColors.textMuted),
                        );
                      }
                      return Column(
                        children: [
                          for (final m in friends) ...[
                            _FriendPickRow(
                              label: m.profile.label,
                              initial: m.profile.initial,
                              selected: _selected.contains(m.profile.userId),
                              onTap: () => _toggle(m.profile.userId),
                            ),
                            const SizedBox(height: NhamSpacing.sp1),
                          ],
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: NhamSpacing.sp4),
                  _SubmitButton(
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

class _ModeCard extends StatelessWidget {
  const _ModeCard({
    required this.label,
    required this.hint,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String hint;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp3,
            vertical: NhamSpacing.sp2_5,
          ),
          decoration: BoxDecoration(
            color: selected ? NhamColors.accent10 : NhamColors.elev,
            borderRadius: BorderRadius.circular(NhamRadii.lg),
            border: Border.all(
              color: selected ? NhamColors.accent50 : NhamColors.borderSoft,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.detail,
                ).copyWith(color: NhamColors.text),
              ),
              const SizedBox(height: 2),
              Text(
                hint,
                style: NhamTextStyles.sansRegular(
                  fontSize: NhamFontSize.xxs,
                ).copyWith(color: NhamColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FriendPickRow extends StatelessWidget {
  const _FriendPickRow({
    required this.label,
    required this.initial,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String initial;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp3,
            vertical: NhamSpacing.sp2_5,
          ),
          decoration: BoxDecoration(
            color: selected ? NhamColors.accent10 : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.containerLg),
          ),
          child: Row(
            children: [
              CircleInitialsAvatar(initial: initial, size: 32),
              const SizedBox(width: NhamSpacing.sp3),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: NhamTextStyles.sansRegular(
                    fontSize: NhamFontSize.sm,
                  ).copyWith(color: NhamColors.text),
                ),
              ),
              if (selected)
                const Icon(LucideIcons.check, size: 16, color: NhamColors.btn),
            ],
          ),
        ),
      ),
    );
  }
}

class _SubmitButton extends StatelessWidget {
  const _SubmitButton({
    required this.label,
    required this.enabled,
    required this.loading,
    required this.onTap,
  });

  final String label;
  final bool enabled;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        child: Container(
          width: double.infinity,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp3),
          decoration: BoxDecoration(
            color: NhamColors.btn,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (loading)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              else
                const Icon(LucideIcons.users, size: 16, color: Colors.white),
              const SizedBox(width: NhamSpacing.sp2),
              Text(
                label,
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.sm,
                ).copyWith(color: Colors.white),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
