import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../services/auth/session_provider.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../circle/data/circle_providers.dart';

/// The person at the top of Settings: a 48pt avatar disc, their name and the
/// signed-in email, opening the identity editor.
///
/// It is a white card of the SAME family as the groups below it (radius 22,
/// 16 horizontal padding) but not a [ListRow] — the row anatomy gives a 24pt
/// leading slot, and this one is twice that. Everything else — the 12 gap, the
/// 14/500 title over a 12 muted second line, the 16pt chevron — is the row
/// system's, so it reads as the first card rather than a different idiom.
class SettingsProfileCard extends ConsumerWidget {
  const SettingsProfileCard({super.key, required this.onTap});

  final VoidCallback onTap;

  static const double _avatar = 48;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(myCircleProfileProvider).valueOrNull;
    final email = ref.watch(currentSessionProvider)?.user.email;
    final name = profile?.label ?? tr('settings.rows.notSet');

    return Semantics(
      button: true,
      excludeSemantics: true,
      label: email == null ? name : '$name, $email',
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: KalloSpacing.sp4,
            vertical: KalloSpacing.sp3,
          ),
          decoration: BoxDecoration(
            color: kCardSurface,
            borderRadius: BorderRadius.circular(KalloRadii.card),
          ),
          child: Row(
            children: [
              _Disc(profile: profile),
              const SizedBox(width: KalloSpacing.sp3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: dashBody(weight: FontWeight.w500),
                    ),
                    if (email != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        email,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: dashMeta(),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: KalloSpacing.sp2),
              const Icon(
                LucideIcons.chevronRight300,
                size: 16,
                color: kInkMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The 48pt disc — the person's own avatar once their circle profile loads, a
/// neutral track-filled placeholder while it hasn't (never a wrong initial).
class _Disc extends StatelessWidget {
  const _Disc({required this.profile});

  final CircleProfile? profile;

  @override
  Widget build(BuildContext context) {
    if (profile != null) {
      return ProfileAvatarDisc(
        profile: profile!,
        size: SettingsProfileCard._avatar,
      );
    }
    return Container(
      width: SettingsProfileCard._avatar,
      height: SettingsProfileCard._avatar,
      decoration: const BoxDecoration(
        color: KalloColors.track,
        shape: BoxShape.circle,
      ),
    );
  }
}
