import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/social/circle.dart';
import '../../data/circle_providers.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import 'portion/portion_battery.dart';
import '../portion/portion_seats.dart';
import 'portion/whole_portion_batteries.dart';

/// The portion block: whichever meter the current tab calls for, plus the
/// "chia đều" reset. Presentation only — every decision stays in the sheet.
/// Who the viewer is is ambient identity, not a share decision, so the meter
/// reads it off the provider rather than having it threaded down. The
/// decisions — mode, parts, the callbacks — still all come from the sheet.
class ShareMealMeter extends ConsumerWidget {
  const ShareMealMeter({
    super.key,
    required this.mode,
    required this.seated,
    required this.parts,
    required this.totalKcal,
    required this.onChanged,
    required this.onRemove,
    required this.onSplitEvenly,
  });

  final String mode;
  final List<CircleProfile> seated;
  final List<int> parts;
  final double? totalKcal;
  final ValueChanged<List<int>> onChanged;
  final ValueChanged<int> onRemove;
  final VoidCallback onSplitEvenly;

  static String initialsOf(CircleProfile p) {
    final source =
        (p.displayName?.trim().isNotEmpty ?? false)
            ? p.displayName!.trim()
            : p.handle;
    final words = source.split(RegExp(r'\s+'));
    if (words.length >= 2) {
      return (words[words.length - 2][0] + words.last[0]).toUpperCase();
    }
    return source.characters.take(2).toString().toUpperCase();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (seated.isEmpty) {
      return Text(tr('groups.shareMeal.pickSomeone'), style: dashMeta());
    }
    final seats = [
      PortionSeat(
        id: 'me',
        profile: ref.watch(myCircleProfileProvider).valueOrNull,
        initials: tr('groups.shareMeal.youInitial'),
        label: tr('groups.shareMeal.you'),
        parts: parts.first,
      ),
      for (var i = 0; i < seated.length; i++)
        PortionSeat(
          id: seated[i].userId,
          profile: seated[i],
          initials: initialsOf(seated[i]),
          label: seated[i].label,
          parts: parts[i + 1],
        ),
    ];

    if (mode == 'whole') {
      // Nothing is divided, so nothing is drawn divided: one full battery per
      // person, at the same unit size the split meter uses.
      return WholePortionBatteries(
        seats: seats,
        totalKcal: totalKcal,
        onRemove: onRemove,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PortionBattery(
          seats: seats,
          totalKcal: totalKcal,
          onChanged: onChanged,
          onRemove: onRemove,
        ),
        const SizedBox(height: KalloSpacing.sp2),
        Align(
          alignment: Alignment.centerRight,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onSplitEvenly,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                vertical: KalloSpacing.sp1,
                horizontal: KalloSpacing.sp1,
              ),
              child: Text(
                tr('groups.shareMeal.splitEvenly'),
                style: dashMeta(color: kInk),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
