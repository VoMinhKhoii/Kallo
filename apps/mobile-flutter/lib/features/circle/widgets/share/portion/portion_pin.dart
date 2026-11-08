import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../models/social/circle.dart';
import '../../../../../theme/calm_tokens.dart';
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

  /// How far the × disc's centre sits from the drop box's top and right edges
  /// — inward, because the disc hangs less than half its width off the box.
  static const double _badgeInset =
      PortionDrop.badge / 2 - PortionDrop.badgeOverhang;

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
        PortionDrop(
          seat: seat,
          profile: profile,
          initials: initials,
          showBadge: onRemove != null,
        ),
        const SizedBox(height: _bottomGap),
      ],
    );
    if (onRemove == null) return marker;

    // The tap target is a layer over the whole pin, not a child of the badge:
    // Flutter only hit-tests inside a parent's bounds, so a target hanging off
    // the drop's box would be dead outside it. Anchored from the bottom, where
    // nothing changes with text size, and kept inside this pin's own column.
    const fromBottom = _bottomGap + PortionDrop.box - _badgeInset;
    const targetBottom = fromBottom - KalloIcons.hit / 2;
    return ConstrainedBox(
      constraints: const BoxConstraints(
        minHeight: targetBottom + KalloIcons.hit,
      ),
      child: LayoutBuilder(
        builder: (context, box) {
          final width = math.min(KalloIcons.hit, box.maxWidth);
          final badgeCentre =
              box.maxWidth / 2 + PortionDrop.box / 2 - _badgeInset;
          return Stack(
            fit: StackFit.passthrough,
            children: [
              marker,
              Positioned(
                left: (badgeCentre - width / 2).clamp(0, box.maxWidth - width),
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
