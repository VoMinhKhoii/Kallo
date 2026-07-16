import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/widgets.dart';
import '../../../shell/app_header.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/circle_providers.dart';
import '../widgets/add_friend_sheet.dart';
import '../widgets/circle_error.dart';
import '../widgets/circle_skeleton.dart';
import '../widgets/circle_wall.dart';
import '../widgets/meal_invites.dart';

/// The Circle surface: your friends' most-recent shared meals for today, plus
/// an Add-friend affordance. Read-only ambient wall — polls every 30s. Mirrors
/// the web `GroupsPage` (`app/[locale]/(app)/groups/page.tsx`), rebranded as
/// "Circle".
class CircleScreen extends ConsumerWidget {
  const CircleScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feedAsync = ref.watch(circleFeedProvider);

    return Screen(
      child: Column(
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: NhamSpacing.sp3),
            child: AppHeader(),
          ),
          Expanded(
            child: RefreshIndicator(
              color: NhamColors.accent,
              backgroundColor: NhamColors.elev,
              onRefresh: () async {
                ref.invalidate(circleFeedProvider);
                try {
                  // Hold the indicator until the refetched feed lands.
                  await ref.read(circleFeedProvider.future);
                } catch (_) {
                  // The error surfaces through the provider's error state.
                }
              },
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(
                  NhamSpacing.sp5,
                  NhamSpacing.sp2,
                  NhamSpacing.sp5,
                  NhamSpacing.sp8,
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 640),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Header(
                          onAddFriend: () => showAddFriendSheet(context),
                        ),
                        const SizedBox(height: NhamSpacing.sp6),
                        const MealInvitesSection(),
                        feedAsync.when(
                          loading: () => const CircleWallSkeleton(),
                          error: (_, __) => CircleErrorCard(
                            onRetry: () => ref.invalidate(circleFeedProvider),
                            isRetrying: feedAsync.isLoading,
                          ),
                          data: (feed) => CircleWall(
                            feed: feed,
                            onAddFriend: () => showAddFriendSheet(context),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Title + subtitle on the left, the "Add friend" pill on the right.
class _Header extends StatelessWidget {
  const _Header({required this.onAddFriend});

  final VoidCallback onAddFriend;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                tr('groups.page.title'),
                style: NhamTextStyles.serifRegular(fontSize: NhamFontSize.h3)
                    .copyWith(
                  color: NhamColors.text,
                  letterSpacing: NhamTracking.tight,
                ),
              ),
              const SizedBox(height: NhamSpacing.sp1),
              Text(
                tr('groups.page.subtitle'),
                style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.sm)
                    .copyWith(color: NhamColors.textMuted),
              ),
            ],
          ),
        ),
        const SizedBox(width: NhamSpacing.sp3),
        _AddFriendButton(onTap: onAddFriend),
      ],
    );
  }
}

class _AddFriendButton extends StatefulWidget {
  const _AddFriendButton({required this.onTap});

  final VoidCallback onTap;

  @override
  State<_AddFriendButton> createState() => _AddFriendButtonState();
}

class _AddFriendButtonState extends State<_AddFriendButton> {
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
          horizontal: NhamSpacing.sp3_5,
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
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.userPlus, size: 16, color: Colors.white),
            const SizedBox(width: NhamSpacing.sp1_5),
            Text(
              tr('groups.page.addFriend'),
              style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.detail)
                  .copyWith(color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}
