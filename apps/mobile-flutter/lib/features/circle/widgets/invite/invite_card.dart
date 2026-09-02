import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/circle_providers.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import 'invite_action.dart';
import '../../../../theme/calm_tokens.dart';

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
      padding: const EdgeInsets.all(KalloSpacing.sp4),
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: BorderRadius.circular(KalloRadii.containerLg),
        border: Border.all(color: KalloColors.borderSoft),
        boxShadow: const [KalloShadows.sm],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ProfileAvatarDisc(profile: invite.from, size: 24),
              const SizedBox(width: KalloSpacing.sp2),
              Expanded(
                child: Text(
                  tr(
                    invite.isSplit
                        ? 'groups.invites.sharedSplit'
                        : 'groups.invites.sharedCopy',
                    namedArgs: {'name': invite.from.label},
                  ),
                  style: dashMeta(color: kInk),
                ),
              ),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                // Body, not serif: the meal text is content, and the serif slot
                // is spent once per viewport (mobile.md).
                child: Text(invite.rawInput, style: dashBody()),
              ),
              if (invite.isSplit && portion.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(left: KalloSpacing.sp2, top: 2),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: KalloColors.accent10,
                    borderRadius: BorderRadius.circular(KalloRadii.pill),
                  ),
                  child: Text(
                    tr(
                      'groups.invites.portion',
                      namedArgs: {'portion': portion},
                    ),
                    // Caption: a fixed pill on the title line, component-internal.
                    style: dashCaption(color: kInk, weight: FontWeight.w500),
                  ),
                ),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp2),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Caption: three tabular pairs sharing the line with the kcal
              // figure — the same dense-legend shape MealBlock justifies.
              Text(
                'P: ${_fmtG(invite.proteinG)}  C: ${_fmtG(invite.carbohydrateG)}  F: ${_fmtG(invite.fatG)}',
                style: dashCaption(tabular: true),
              ),
              Text(_fmtKcal(invite.caloriesKcal), style: dashValue()),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp3),
          const Divider(height: 1, thickness: 1, color: KalloColors.borderFaint),
          const SizedBox(height: KalloSpacing.sp3),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              InviteAction(
                icon: LucideIcons.x300,
                label: tr('groups.invites.dismiss'),
                onTap: _busy ? null : _dismiss,
                filled: false,
              ),
              const SizedBox(width: KalloSpacing.sp2),
              InviteAction(
                icon: LucideIcons.check300,
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
