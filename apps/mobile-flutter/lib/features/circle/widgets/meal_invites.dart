import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

String _fmtKcal(double? v) =>
    v == null ? tr('groups.invites.na') : '${v.round()} kcal';
String _fmtG(double? v) =>
    v == null ? tr('groups.invites.na') : '${v.round()}g';

/// A portion fraction as "1/N" (0.5 → "1/2"), or empty for a full portion.
String _portionLabel(double factor) {
  if (!factor.isFinite || factor <= 0 || factor >= 1) return '';
  return '1/${(1 / factor).round()}';
}

/// The Circle inbox: pending copy/split offers addressed to me. Renders nothing
/// when empty. Mirrors the web `MealInvites`.
class MealInvitesSection extends ConsumerWidget {
  const MealInvitesSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invitesAsync = ref.watch(mealShareInvitesProvider);
    return invitesAsync.when(
      loading: () => const SizedBox.shrink(),
      // A failed fetch must not read as "no invites" — a quiet, tappable retry.
      error:
          (_, __) => Padding(
            padding: const EdgeInsets.only(bottom: NhamSpacing.sp4),
            child: GestureDetector(
              onTap: () => ref.invalidate(mealShareInvitesProvider),
              child: Text(
                tr('groups.invites.loadError'),
                style: NhamTextStyles.sansRegular(
                  fontSize: NhamFontSize.xs,
                ).copyWith(color: NhamColors.textMuted),
              ),
            ),
          ),
      data: (invites) {
        if (invites.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            NhamText(
              tr('groups.invites.title'),
              variant: NhamTextVariant.eyebrow,
            ),
            const SizedBox(height: NhamSpacing.sp3),
            for (final invite in invites) ...[
              _InviteCard(invite: invite),
              const SizedBox(height: NhamSpacing.sp3),
            ],
            const SizedBox(height: NhamSpacing.sp3),
          ],
        );
      },
    );
  }
}

class _InviteCard extends ConsumerStatefulWidget {
  const _InviteCard({required this.invite});

  final MealShareInvite invite;

  @override
  ConsumerState<_InviteCard> createState() => _InviteCardState();
}

class _InviteCardState extends ConsumerState<_InviteCard> {
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
    final sender = invite.from.label;
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
                    namedArgs: {'name': sender},
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
              if (invite.isSplit &&
                  _portionLabel(invite.portionFactor).isNotEmpty)
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
                      namedArgs: {
                        'portion': _portionLabel(invite.portionFactor),
                      },
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
              _InviteAction(
                icon: LucideIcons.x,
                label: tr('groups.invites.dismiss'),
                onTap: _busy ? null : _dismiss,
                filled: false,
              ),
              const SizedBox(width: NhamSpacing.sp2),
              _InviteAction(
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

class _InviteAction extends StatelessWidget {
  const _InviteAction({
    required this.icon,
    required this.label,
    required this.onTap,
    required this.filled,
    this.loading = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool filled;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final fg = filled ? NhamColors.text : NhamColors.textMuted;
    return Opacity(
      opacity: onTap == null ? 0.6 : 1,
      child: GestureDetector(
        onTap:
            onTap == null
                ? null
                : () {
                  HapticFeedback.lightImpact();
                  onTap!();
                },
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp3_5,
            vertical: NhamSpacing.sp1_5,
          ),
          decoration: BoxDecoration(
            color: filled ? NhamColors.accent10 : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.pill),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (loading)
                const SizedBox(
                  width: 13,
                  height: 13,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: NhamColors.accentDark,
                  ),
                )
              else
                Icon(icon, size: 13, color: fg),
              const SizedBox(width: NhamSpacing.sp1_5),
              NhamText(
                label,
                variant: NhamTextVariant.chipText,
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.xs,
                ).copyWith(color: fg),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
