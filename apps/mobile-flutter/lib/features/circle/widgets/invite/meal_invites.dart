import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/typography/section_header_row.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/circle_providers.dart';
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
            padding: const EdgeInsets.only(top: KalloSpacing.sp3),
            child: Semantics(
              button: true,
              label: tr('groups.invites.loadError'),
              excludeSemantics: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => ref.invalidate(mealShareInvitesProvider),
                child: Container(
                  alignment: Alignment.centerLeft,
                  constraints: const BoxConstraints(minHeight: KalloIcons.hit),
                  child: Text(
                    tr('groups.invites.loadError'),
                    style: dashMeta(),
                  ),
                ),
              ),
            ),
          ),
      data: (invites) {
        if (invites.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: KalloSpacing.sp3),
            // Mixed-case group label, not the retired uppercase eyebrow
            // (native pass, 2026-08-31): this reads as the quiet tier above a
            // card, the same as "Today" over the day group below it.
            GroupLabel(tr('groups.invites.title')),
            const SizedBox(height: KalloSpacing.sp3),
            for (final invite in invites) ...[
              InviteCard(invite: invite),
              const SizedBox(height: KalloSpacing.sp3),
            ],
          ],
        );
      },
    );
  }
}
