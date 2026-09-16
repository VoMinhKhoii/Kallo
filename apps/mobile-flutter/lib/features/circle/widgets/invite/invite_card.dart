import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/circle_providers.dart';
import '../share/portion_battery.dart' show kSeatColors;
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
      builder: (sheetContext) => KalloSheetSurface(
        padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            KalloSheetHeader(title: widget.invite.from.label),
            _OverflowRow(
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
              _AvatarWithBadge(profile: invite.from),
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
              _BlackPill(
                label: tr('groups.invites.acceptShort'),
                loading: _busy,
                onTap: _accept,
              ),
              _OverflowButton(onTap: _busy ? null : _openOverflow),
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
              mineLabel: tr('groups.invites.yourShare',
                  namedArgs: {'percent': '$percent'}),
              restLabel: tr('groups.invites.restShare',
                  namedArgs: {'percent': '${100 - percent}'}),
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

/// The avatar with a status badge, so the KIND of notification is readable
/// before any text is — and stays readable once the row goes quiet.
class _AvatarWithBadge extends StatelessWidget {
  const _AvatarWithBadge({required this.profile});

  final CircleProfile profile;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 42,
      height: 42,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          ProfileAvatarDisc(profile: profile, size: 42),
          Positioned(
            right: -2,
            bottom: -2,
            child: Container(
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                color: kSeatColors[1],
                shape: BoxShape.circle,
                border: Border.all(color: KalloColors.elev, width: 2),
              ),
              child: const Icon(
                LucideIcons.check300,
                size: 9,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The one live action in the row. Ink fill, white label — the highest contrast
/// the cream canvas allows, which is the role white-on-dark plays in Threads.
class _BlackPill extends StatelessWidget {
  const _BlackPill({
    required this.label,
    required this.loading,
    required this.onTap,
  });

  final String label;
  final bool loading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: loading ? null : onTap,
        child: Opacity(
          opacity: loading ? 0.55 : 1,
          child: Container(
            height: 36,
            constraints: const BoxConstraints(minWidth: 72),
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
            decoration: BoxDecoration(
              color: KalloColors.text,
              borderRadius: BorderRadius.circular(KalloRadii.pill),
            ),
            child: loading
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Text(label, style: dashMeta(color: Colors.white)),
          ),
        ),
      ),
    );
  }
}

class _OverflowButton extends StatelessWidget {
  const _OverflowButton({required this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tr('common.more'),
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: const SizedBox(
          width: KalloIcons.hit,
          height: KalloIcons.hit,
          child: Icon(
            LucideIcons.ellipsis300,
            size: KalloIcons.size,
            color: KalloColors.textMuted,
          ),
        ),
      ),
    );
  }
}

class _OverflowRow extends StatelessWidget {
  const _OverflowRow({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: KalloIcons.hit + 8),
        child: Row(
          children: [
            Icon(icon, size: KalloIcons.size, color: KalloColors.textMuted),
            const SizedBox(width: KalloSpacing.sp3),
            Text(label, style: dashBody()),
          ],
        ),
      ),
    );
  }
}
