import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/circle_providers.dart';
import 'invite_card.dart';

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
              InviteCard(invite: invite),
              const SizedBox(height: NhamSpacing.sp3),
            ],
            const SizedBox(height: NhamSpacing.sp3),
          ],
        );
      },
    );
  }
}
