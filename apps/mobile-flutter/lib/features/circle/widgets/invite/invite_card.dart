import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/social/circle.dart';
import '../../../../services/billing/entitlement_state.dart';
import '../../../../services/billing/feature_lock.dart';
import '../../../../shared/widgets/badges/premium_chip.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/invite_actions.dart';
import '../portion/portion_seats.dart' show kSeatColors;
import 'invite_card_parts.dart';
import 'portion_readout.dart';

/// An offer someone made you: the person, what they did, the meal, and the two
/// choices side by side at the bottom.
///
/// The dismiss used to live in a `⋯` overflow sheet, on the reasoning that two
/// competing buttons made the primary action the smallest thing in the card.
/// The deck changed what that costs — the only way past an offer is to act on
/// it, so declining one was two taps and a sheet every time, while the header
/// carried three controls beside the sender's name. Weight separates the two
/// now instead of position: a filled pill against a quiet one.
class InviteCard extends ConsumerStatefulWidget {
  const InviteCard({required this.invite, super.key});

  final MealShareInvite invite;

  @override
  ConsumerState<InviteCard> createState() => _InviteCardState();
}

class _InviteCardState extends ConsumerState<InviteCard> {
  bool _busy = false;

  // Both buttons ask first; the card goes busy only once the reader has said
  // yes, so backing out of the confirm leaves it exactly as it was.
  Future<void> _respond({
    required bool dismiss,
    required Future<bool> Function() act,
  }) async {
    if (_busy) return;
    if (!await confirmInviteResponse(
          context,
          widget.invite,
          dismiss: dismiss,
        ) ||
        !mounted) {
      return;
    }
    setState(() => _busy = true);
    if (!dismiss) HapticFeedback.selectionClick();
    if (!await act() && mounted) setState(() => _busy = false);
  }

  Future<void> _accept() => _respond(
    dismiss: false,
    act: () => takeInviteOffer(context, ref, widget.invite),
  );

  Future<void> _dismiss() => _respond(
    dismiss: true,
    act: () => dismissInviteOffer(context, ref, widget.invite.id),
  );

  @override
  Widget build(BuildContext context) {
    final invite = widget.invite;
    // Taking a cheat offer is a cheat WRITE (`cheat_meal`): chip it at the
    // header's right end and send the accept straight to the paywall, rather
    // than confirming a step whose only outcome is a 402.
    // Watched unconditionally, then narrowed to cheat offers.
    final cheatLock = premiumGate(ref, PremiumFeature.cheatMeal);
    final gate = PremiumGate(locked: invite.isCheat && cheatLock.locked);
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
                        invite.subtitleKey,
                        namedArgs: {'name': invite.from.label},
                      ),
                      style: dashMeta(),
                    ),
                  ],
                ),
              ),
              if (gate.locked) const PremiumChip(),
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
                'P: ${fmtInviteG(invite.proteinG)}  C: ${fmtInviteG(invite.carbohydrateG)}  F: ${fmtInviteG(invite.fatG)}',
                style: dashCaption(tabular: true),
              ),
              Text(fmtInviteKcal(invite.caloriesKcal), style: dashValue()),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp4),
          // Both choices, side by side, at the bottom.
          //
          // The dismiss used to live in a `⋯` overflow sheet, on the reasoning
          // that two competing buttons made the primary action the smallest
          // thing in the card. The deck changed what that costs: the only way
          // past an offer is to act on it, so declining one was two taps and a
          // sheet, every time, and the card's own header was carrying three
          // controls beside the sender's name. Side by side, the choice is one
          // tap either way and the header goes back to being an identity line.
          // Weight still separates them — a filled pill against a quiet one.
          Row(
            children: [
              Expanded(
                child: KalloButton(
                  variant: KalloButtonVariant.secondary,
                  compact: true,
                  title: tr('groups.invites.dismiss'),
                  disabled: _busy,
                  onPressed: _dismiss,
                ),
              ),
              const SizedBox(width: KalloSpacing.sp3),
              Expanded(
                child: KalloButton(
                  variant: KalloButtonVariant.cta,
                  compact: true,
                  title: tr(invite.acceptLabelKey),
                  loading: _busy,
                  onPressed: gate.tap(context, _accept),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
