import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/circle.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import 'circle_card.dart';
import 'circle_presence_strip.dart';

/// The ambient Circle wall: the presence strip (who's in your circle, who
/// shared today), then most-recent-per-friend cards for today — bounded
/// server-side, read-only and badge-free by design. Never a global newsfeed.
/// Mirrors `CircleWall` in `components/groups/circle-wall.tsx`.
class CircleWall extends StatelessWidget {
  const CircleWall({
    required this.feed,
    required this.onAddFriend,
    super.key,
  });

  final List<CircleFeedEntry> feed;
  final VoidCallback onAddFriend;

  @override
  Widget build(BuildContext context) {
    final sharedTodayUserIds =
        feed.map((entry) => entry.friend.userId).toSet();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Membership + today's participation at a glance — shows even when
        // nobody has shared yet (the wall below is simply quiet).
        CirclePresenceStrip(sharedTodayUserIds: sharedTodayUserIds),
        if (feed.isEmpty)
          _CircleEmpty(onAddFriend: onAddFriend)
        else
          for (var i = 0; i < feed.length; i++)
            _TimelineRow(
              entry: feed[i],
              isLast: i == feed.length - 1,
            ),
      ],
    );
  }
}

/// A card with its left timeline rail — a tan dot at the identity row and a
/// hairline that runs down to the next entry (transparent on the last).
class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.entry, required this.isLast});

  final CircleFeedEntry entry;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 22,
            child: Stack(
              children: [
                // Connecting hairline — spans the card + the gap below it.
                Positioned(
                  top: 10,
                  bottom: 0,
                  left: 10,
                  child: Container(
                    width: 1,
                    color: isLast ? Colors.transparent : NhamColors.borderSoft,
                  ),
                ),
                // The dot, aligned with the friend-identity row.
                Positioned(
                  top: 6,
                  left: 6,
                  child: Container(
                    width: 9,
                    height: 9,
                    decoration: BoxDecoration(
                      color: NhamColors.elev,
                      shape: BoxShape.circle,
                      border: Border.all(color: NhamColors.accent, width: 2),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : NhamSpacing.sp6),
              child: CircleCard(entry: entry),
            ),
          ),
        ],
      ),
    );
  }
}

/// Calm empty state — the social wall is simply quiet until a friend connects
/// or shares. Naked on the cream surface (no card), mirroring
/// `components/groups/circle-empty.tsx`.
class _CircleEmpty extends StatelessWidget {
  const _CircleEmpty({required this.onAddFriend});

  final VoidCallback onAddFriend;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 56), // py-14
      child: Column(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: NhamColors.borderFaint, // border @ 30%
              borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
            ),
            child: const Icon(LucideIcons.users,
                size: 20, color: NhamColors.textMuted),
          ),
          const SizedBox(height: NhamSpacing.sp4),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 384), // max-w-sm
            child: Column(
              children: [
                Text(
                  tr('groups.empty.title'),
                  textAlign: TextAlign.center,
                  style: NhamTextStyles.serifRegular(fontSize: NhamFontSize.h4)
                      .copyWith(
                    color: NhamColors.text,
                    letterSpacing: NhamTracking.tight,
                  ),
                ),
                const SizedBox(height: NhamSpacing.sp1_5),
                Text(
                  tr('groups.empty.subtitle'),
                  textAlign: TextAlign.center,
                  style: NhamTextStyles.sansRegular(
                    fontSize: NhamFontSize.sm,
                    height: NhamLeading.relaxed,
                  ).copyWith(color: NhamColors.textMuted),
                ),
              ],
            ),
          ),
          const SizedBox(height: NhamSpacing.sp4),
          _EmptyCta(onTap: onAddFriend),
        ],
      ),
    );
  }
}

/// Compact umber CTA pill — px-4 py-2, 13px medium, radius 12, btn shadow.
class _EmptyCta extends StatefulWidget {
  const _EmptyCta({required this.onTap});

  final VoidCallback onTap;

  @override
  State<_EmptyCta> createState() => _EmptyCtaState();
}

class _EmptyCtaState extends State<_EmptyCta> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () {
        HapticFeedback.lightImpact();
        widget.onTap();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp4,
          vertical: NhamSpacing.sp2,
        ),
        decoration: BoxDecoration(
          color: _pressed ? NhamColors.btnHover : NhamColors.btn,
          borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
          boxShadow: const [
            BoxShadow(
              color: Color(0x33695E4E), // btn @ 20%
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Text(
          tr('groups.empty.cta'),
          style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.detail)
              .copyWith(color: Colors.white),
        ),
      ),
    );
  }
}
