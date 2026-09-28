import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/social/circle.dart';
import '../../../../services/auth/session_provider.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../shared/widgets/surface/kallo_small_button.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../circle/data/circle_providers.dart';
import '../../../circle/data/local_blocks.dart';

/// The person at the top of Settings: a 64pt avatar, their name over the
/// signed-in email, their friend count where the chevron used to be, and two
/// small buttons under it — "Sửa hồ sơ" and "Sửa vòng kết nối".
///
/// No card (2026-09-28): it sits on the canvas like a profile header, not as
/// the first row of a settings list — the two buttons say what it opens, so
/// the whole block no longer has to be one big tap target with a chevron.
class SettingsProfileHeader extends ConsumerWidget {
  const SettingsProfileHeader({
    super.key,
    required this.onEditProfile,
    required this.onEditCircle,
  });

  final VoidCallback onEditProfile;

  /// Opens "Edit circle" on its Friends tab — from the button and from the
  /// friend count alike.
  final VoidCallback onEditCircle;

  static const double _avatar = 64;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(myCircleProfileProvider).valueOrNull;
    final email = ref.watch(currentSessionProvider)?.user.email;
    final name = profile?.label ?? tr('settings.rows.notSet');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp1),
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
                      style: kSectionHeader(),
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
              _FriendCount(onTap: onEditCircle),
            ],
          ),
        ),
        const SizedBox(height: KalloSpacing.sp2),
        Row(
          children: [
            Expanded(
              child: KalloSmallButton(
                expand: true,
                label: tr('settings.me.editProfile'),
                onPressed: onEditProfile,
              ),
            ),
            const SizedBox(width: KalloSpacing.sp2),
            Expanded(
              child: KalloSmallButton(
                expand: true,
                label: tr('settings.me.editCircle'),
                onPressed: onEditCircle,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// "12 / bạn bè" stacked, opening the Friends tab. The number is the one
/// figure on the header, so it takes the name's 16/600; the word under it is
/// meta. Friends only — pending invites are not in anyone's circle yet.
class _FriendCount extends ConsumerWidget {
  const _FriendCount({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final members = ref.watch(visibleCircleFriendsProvider).valueOrNull;
    final count = members?.where((m) => m.isAccepted).length;
    // A dash until the list lands, never a 0 that is not true yet.
    final figure = count == null ? '–' : '$count';
    return Semantics(
      button: true,
      excludeSemantics: true,
      label:
          count == null
              ? tr('settings.me.editCircle')
              : tr('settings.me.friendsLabel', namedArgs: {'count': '$count'}),
      onTap: onTap,
      child: CupertinoButton(
        minimumSize: const Size(KalloIcons.hit, KalloIcons.hit),
        padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp2),
        onPressed: onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(figure, style: kSectionHeader()),
            Text(plural('settings.me.friends', count ?? 0), style: dashMeta()),
          ],
        ),
      ),
    );
  }
}

/// The 64pt disc — the person's own avatar once their circle profile loads, a
/// neutral track-filled placeholder while it hasn't (never a wrong initial).
class _Disc extends StatelessWidget {
  const _Disc({required this.profile});

  final CircleProfile? profile;

  @override
  Widget build(BuildContext context) {
    if (profile != null) {
      return ProfileAvatarDisc(
        profile: profile!,
        size: SettingsProfileHeader._avatar,
      );
    }
    return Container(
      width: SettingsProfileHeader._avatar,
      height: SettingsProfileHeader._avatar,
      decoration: const BoxDecoration(
        color: KalloColors.track,
        shape: BoxShape.circle,
      ),
    );
  }
}
