import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/form/option_strip.dart' show OptionStripItem;
import '../../../../shared/widgets/form/segmented/segmented_strip.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/split_parts.dart';
import 'add_friend_row.dart';
import 'share_meal_meter.dart';

/// The sheet's scrolling half: the tabs, the meter, and the add-only lane.
///
/// The lane is a FIXED height on purpose — it is what keeps the footer from
/// moving, whether one friend is left in the list or nine, and whether the tab
/// is whole or split.
class ShareMealBody extends StatelessWidget {
  const ShareMealBody({
    super.key,
    required this.mode,
    required this.seated,
    required this.parts,
    required this.totalKcal,
    required this.friends,
    required this.laneHeight,
    required this.onModeChanged,
    required this.onPartsChanged,
    required this.onRemoveSeat,
    required this.onSplitEvenly,
    required this.onAdd,
  });

  final String mode;
  final List<CircleProfile> seated;
  final List<int> parts;
  final double? totalKcal;
  final List<CircleMember> friends;
  final double laneHeight;
  final ValueChanged<String> onModeChanged;
  final ValueChanged<List<int>> onPartsChanged;
  final ValueChanged<int> onRemoveSeat;
  final VoidCallback onSplitEvenly;
  final ValueChanged<CircleProfile> onAdd;

  @override
  Widget build(BuildContext context) {
    final unseated =
        friends
            .where((m) => !seated.any((s) => s.userId == m.profile.userId))
            .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SegmentedStrip(
          options: [
            OptionStripItem(
              value: 'whole',
              label: tr('groups.shareMeal.mode.whole'),
            ),
            OptionStripItem(
              value: 'split',
              label: tr('groups.shareMeal.mode.split'),
            ),
          ],
          activeIndex: mode == 'whole' ? 0 : 1,
          onChange: onModeChanged,
        ),
        const SizedBox(height: KalloSpacing.sp4),
        // The meter's height differs between the two modes, so the change is
        // animated rather than a jump the eye reads as a relayout.
        AnimatedSize(
          duration: KalloMotion.quick,
          curve: Curves.easeOut,
          alignment: Alignment.topCenter,
          child: ShareMealMeter(
            mode: mode,
            seated: seated,
            parts: parts,
            totalKcal: totalKcal,
            onChanged: onPartsChanged,
            onRemove: onRemoveSeat,
            onSplitEvenly: onSplitEvenly,
          ),
        ),
        const SizedBox(height: KalloSpacing.sp4),
        Text(tr('groups.shareMeal.addSectionTitle'), style: dashMeta()),
        SizedBox(
          height: laneHeight,
          child:
              unseated.isEmpty
                  ? Align(
                    alignment: Alignment.topLeft,
                    child: Padding(
                      padding: const EdgeInsets.only(top: KalloSpacing.sp3),
                      child: Text(
                        tr('groups.shareMeal.allAdded'),
                        style: dashMeta(),
                      ),
                    ),
                  )
                  : ListView.builder(
                    padding: EdgeInsets.zero,
                    itemCount: unseated.length,
                    itemBuilder:
                        (_, i) => AddFriendRow(
                          profile: unseated[i].profile,
                          // Past the palette there is no seat to give them.
                          enabled: seated.length + 1 < kMaxParticipants,
                          onTap: () => onAdd(unseated[i].profile),
                        ),
                  ),
        ),
      ],
    );
  }
}
