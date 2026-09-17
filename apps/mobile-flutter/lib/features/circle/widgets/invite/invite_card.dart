import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/circle_providers.dart';
import '../portion/portion_seats.dart' show kSeatColors;
import 'invite_card_parts.dart';
import 'portion_readout.dart';

String _fmtKcal(double? value) =>
    value == null ? tr('groups.invites.na') : '${value.round()} kcal';

String _fmtG(double? value) =>
    value == null ? tr('groups.invites.na') : '${value.round()}g';

/// An offer someone made you, shaped like a Threads notification: the person,
/// what they did, and ONE live action as a filled pill on the trailing edge.
///
/// The dismiss lives in the overflow rather than beside the accept. Two
/// competing buttons made the primary action the smallest thing in the card and
/// put it furthest from the thumb; one filled pill and a `⋯` is the shape every
/// notification list converged on for a reason.
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
    HapticFeedback.selectionClick();
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

  /// The overflow. One entry today, but it is the slot every later "mute this
  /// person", "report" and "why am I seeing this" belongs in.
  Future<void> _openOverflow() async {
    await showNhamSheet<void>(
      context,
      builder:
          (sheetContext) => KalloSheetSurface(
            padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                KalloSheetHeader(title: widget.invite.from.label),
                InviteOverflowRow(
                  icon: LucideIcons.x300,
                  label: tr('groups.invites.dismiss'),
                  onTap: () {
                    Navigator.of(sheetContext).pop();
                    _dismiss();
                  },
                ),
                const SizedBox(height: KalloSpacing.sp5),
              ],
            ),
          ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final invite = widget.invite;
    final percent = (invite.portionFactor * 100).round();

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
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              InviteAvatarWithBadge(profile: invite.from),
              const SizedBox(width: KalloSpacing.sp3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(invite.from.label, style: dashName()),
                    Text(
                      tr(
                        invite.isSplit
                            ? 'groups.invites.sharedSplit'
                            : 'groups.invites.sharedCopy',
                        namedArgs: {'name': invite.from.label},
                      ),
                      style: dashMeta(),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: KalloSpacing.sp2),
              KalloButton(
                variant: KalloButtonVariant.cta,
                compact: true,
                title: tr('groups.invites.acceptShort'),
                loading: _busy,
                onPressed: _accept,
              ),
              InviteOverflowButton(onTap: _busy ? null : _openOverflow),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp3),
          Text(invite.rawInput, style: dashBody()),
          if (invite.isSplit) ...[
            const SizedBox(height: KalloSpacing.sp3),
            // Read-only: the recipient is being shown a division, not offered
            // one. Only THEIR run is tinted — the remainder is neutral rather
            // than attributed, because a single invite cannot know how the
            // other shares were split between everyone else.
            PortionReadout(
              minePercent: percent,
              mineColor: kSeatColors[1],
              mineLabel: tr(
                'groups.invites.yourShare',
                namedArgs: {'percent': '$percent'},
              ),
              restLabel: tr(
                'groups.invites.restShare',
                namedArgs: {'percent': '${100 - percent}'},
              ),
            ),
          ],
          const SizedBox(height: KalloSpacing.sp3),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'P: ${_fmtG(invite.proteinG)}  C: ${_fmtG(invite.carbohydrateG)}  F: ${_fmtG(invite.fatG)}',
                style: dashCaption(tabular: true),
              ),
              Text(_fmtKcal(invite.caloriesKcal), style: dashValue()),
            ],
          ),
        ],
      ),
    );
  }
}
