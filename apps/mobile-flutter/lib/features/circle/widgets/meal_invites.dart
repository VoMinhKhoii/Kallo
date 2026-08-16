import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/kallo_text.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';
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
            padding: const EdgeInsets.only(bottom: KalloSpacing.sp4),
            child: GestureDetector(
              onTap: () => ref.invalidate(mealShareInvitesProvider),
              child: Text(
                tr('groups.invites.loadError'),
                style: KalloTextStyles.sansRegular(
                  fontSize: KalloFontSize.xs,
                ).copyWith(color: KalloColors.textMuted),
              ),
            ),
          ),
      data: (invites) {
        if (invites.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            KalloText(
              tr('groups.invites.title'),
              variant: KalloTextVariant.eyebrow,
            ),
            const SizedBox(height: KalloSpacing.sp3),
            for (final invite in invites) ...[
              InviteCard(invite: invite),
              const SizedBox(height: KalloSpacing.sp3),
            ],
            const SizedBox(height: KalloSpacing.sp3),
          ],
        );
      },
    );
  }
}
