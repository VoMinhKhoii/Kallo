import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/circle.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/circle_providers.dart';
import 'circle_avatar.dart';
import 'invite_action.dart';

String _fmtKcal(double? value) =>
    value == null ? tr('groups.invites.na') : '${value.round()} kcal';

String _fmtG(double? value) =>
    value == null ? tr('groups.invites.na') : '${value.round()}g';

/// A portion fraction as "1/N" (0.5 → "1/2"), or empty for a full portion.
String _portionLabel(double factor) {
  if (!factor.isFinite || factor <= 0 || factor >= 1) return '';
  return '1/${(1 / factor).round()}';
}

class InviteCard extends ConsumerStatefulWidget {
  const InviteCard({required this.invite, super.key});

  final MealShareInvite invite;

  @override
  ConsumerState<InviteCard> createState() => _InviteCardState();
}

class _InviteCardState extends ConsumerState<InviteCard> {
  bool _busy = false;

  Future<void> _accept() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await acceptMealShareInvite(ref, widget.invite.id);
      if (!mounted) return;
      showTopToast(context, tr('groups.invites.accepted'));
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      showTopToast(
        context,
        tr('groups.invites.error'),
        variant: TopToastVariant.error,
      );
    }
  }

  Future<void> _dismiss() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await dismissMealShareInvite(ref, widget.invite.id);
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
      showTopToast(
        context,
        tr('groups.invites.error'),
        variant: TopToastVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final invite = widget.invite;
    final portion = _portionLabel(invite.portionFactor);
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        border: Border.all(color: NhamColors.borderSoft),
        boxShadow: const [NhamShadows.sm],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleInitialsAvatar(initial: invite.from.initial, size: 24),
              const SizedBox(width: NhamSpacing.sp2),
              Expanded(
                child: Text(
                  tr(
                    invite.isSplit
                        ? 'groups.invites.sharedSplit'
                        : 'groups.invites.sharedCopy',
                    namedArgs: {'name': invite.from.label},
                  ),
                  style: NhamTextStyles.sansRegular(
                    fontSize: NhamFontSize.xs,
                  ).copyWith(color: NhamColors.text),
                ),
              ),
            ],
          ),
          const SizedBox(height: NhamSpacing.sp2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: NhamText(
                  invite.rawInput,
                  variant: NhamTextVariant.mealQuote,
                  style: const TextStyle(fontSize: 17, height: 28 / 17),
                ),
              ),
              if (invite.isSplit && portion.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(left: NhamSpacing.sp2, top: 2),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: NhamColors.accent10,
                    borderRadius: BorderRadius.circular(NhamRadii.pill),
                  ),
                  child: Text(
                    tr(
                      'groups.invites.portion',
                      namedArgs: {'portion': portion},
                    ),
                    style: NhamTextStyles.sansMedium(
                      fontSize: NhamFontSize.xxs,
                    ).copyWith(color: NhamColors.text),
                  ),
                ),
            ],
          ),
          const SizedBox(height: NhamSpacing.sp2),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              NhamText(
                'P: ${_fmtG(invite.proteinG)}  C: ${_fmtG(invite.carbohydrateG)}  F: ${_fmtG(invite.fatG)}',
                variant: NhamTextVariant.captionTabular,
              ),
              NhamText(
                _fmtKcal(invite.caloriesKcal),
                variant: NhamTextVariant.numStrong,
              ),
            ],
          ),
          const SizedBox(height: NhamSpacing.sp3),
          const Divider(height: 1, thickness: 1, color: NhamColors.borderFaint),
          const SizedBox(height: NhamSpacing.sp3),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              InviteAction(
                icon: LucideIcons.x,
                label: tr('groups.invites.dismiss'),
                onTap: _busy ? null : _dismiss,
                filled: false,
              ),
              const SizedBox(width: NhamSpacing.sp2),
              InviteAction(
                icon: LucideIcons.check,
                label: tr('groups.invites.accept'),
                onTap: _busy ? null : _accept,
                filled: true,
                loading: _busy,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
