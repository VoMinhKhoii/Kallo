import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../models/social/circle.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import 'portion_drop.dart';

/// One person's marker: their kcal over an inverted water drop carrying their
/// face, pointing down at the run of cells that belongs to them.
///
/// Twin of `PortionPin` in `components/groups/share-meal/portion/pin.tsx`.
class PortionPin extends StatelessWidget {
  const PortionPin({
    required this.seat,
    required this.profile,
    required this.initials,
    required this.kcal,
    required this.onRemove,
    super.key,
  });

  /// Index into [kSeatColors] — the colour this person's cells are painted in.
  final int seat;

  final CircleProfile? profile;

  /// Drawn when there is no photo. For seat 0 this is the localised "You",
  /// never a name initial, which is why the caller supplies it.
  final String initials;

  final int? kcal;
  final VoidCallback? onRemove;

  /// Between the drop's tip and the battery.
  static const double _bottomGap = 12;

  /// The × disc.
  static const double _badge = 18;

  /// How far the disc's centre sits from the drop box's top and right edges.
  static const double _badgeInset = 3;

  @override
  Widget build(BuildContext context) {
    final marker = Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        if (kcal != null)
          Text(
            '$kcal',
            style: dashMeta(color: kInk),
            maxLines: 1,
            overflow: TextOverflow.clip,
          ),
        const SizedBox(height: 6),
        PortionDrop(seat: seat, profile: profile, initials: initials),
        const SizedBox(height: _bottomGap),
      ],
    );
    if (onRemove == null) return marker;

    // The × and its target are a layer over the whole pin, not part of the
    // drop: Flutter only hit-tests inside a parent's bounds, so a target
    // hanging off the drop's box would be dead outside it. Anchored from the
    // bottom, where nothing changes with text size. Both stay inside this
    // pin's own column, or on a narrow run the × drawn for one person would
    // sit over the next person's target and remove them instead.
    const fromBottom = _bottomGap + PortionDrop.box - _badgeInset;
    const targetBottom = fromBottom - KalloIcons.hit / 2;
    return ConstrainedBox(
      constraints: const BoxConstraints(
        minHeight: targetBottom + KalloIcons.hit,
      ),
      child: LayoutBuilder(
        builder: (context, box) {
          final width = math.min(KalloIcons.hit, box.maxWidth);
          final badgeCentre = math.min(
            box.maxWidth / 2 + PortionDrop.box / 2 - _badgeInset,
            box.maxWidth - _badge / 2,
          );
          return Stack(
            fit: StackFit.passthrough,
            children: [
              marker,
              // Drawn beside the target rather than inside it, so both are
              // placed in this one coordinate system.
              Positioned(
                left: badgeCentre - _badge / 2,
                bottom: fromBottom - _badge / 2,
                child: IgnorePointer(
                  child: Container(
                    width: _badge,
                    height: _badge,
                    decoration: BoxDecoration(
                      color: KalloColors.elev,
                      shape: BoxShape.circle,
                      border: Border.all(color: KalloColors.border),
                    ),
                    child: Icon(
                      LucideIcons.x300,
                      size: 11,
                      color: KalloColors.textSoft,
                    ),
                  ),
                ),
              ),
              Positioned(
                left: (badgeCentre - width / 2).clamp(
                  0.0,
                  box.maxWidth - width,
                ),
                bottom: targetBottom,
                width: width,
                height: KalloIcons.hit,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    onRemove!();
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
