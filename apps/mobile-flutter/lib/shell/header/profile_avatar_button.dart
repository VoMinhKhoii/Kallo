import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/circle/data/circle_providers.dart';
import '../../features/onboarding/providers/onboarding_providers.dart';
import '../../shared/widgets/avatar/profile_avatar.dart';
import '../../services/auth/session_provider.dart';
import '../../theme/calm_tokens.dart';
import '../../theme/kallo_typography.dart';
import 'app_header.dart';
import 'app_header_status_dots.dart';

/// The dashboard header's profile button (native pass, 2026-08-31): a 36pt
/// initials disc in a 44pt target that pushes Settings — the entry the
/// retired hamburger/drawer used to provide. Carries the onboarding
/// pulse-dot while setup is incomplete (the resume nudge now lives at the
/// top of Settings).
///
/// It renders the viewer's actual photo when there is one: the button used to
/// draw an initials disc off the session email and never looked at
/// `avatarUrl` at all, so a user who had uploaded a picture saw it everywhere
/// EXCEPT the header. The email initial stays as the fallback for the frames
/// before the profile resolves (and if it ever fails).
class ProfileAvatarButton extends ConsumerWidget {
  const ProfileAvatarButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final onboardingIncomplete = ref.watch(onboardingResumeProvider);
    final email = ref.watch(currentSessionProvider)?.user.email ?? '';
    final initial = email.isEmpty ? '·' : email[0].toUpperCase();
    final profile = ref.watch(myCircleProfileProvider).valueOrNull;

    return Semantics(
      button: true,
      label: tr('app.mainSidebar.settings'),
      excludeSemantics: true,
      onTap: () => context.push('/settings'),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => context.push('/settings'),
        child: SizedBox(
          width: AppHeader.slotSize,
          height: AppHeader.slotSize,
          child: Center(
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                if (profile != null)
                  ProfileAvatarDisc(profile: profile, size: 36)
                else
                  Container(
                    width: 36,
                    height: 36,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                      color: kTrack,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      initial,
                      style: const TextStyle(
                        fontFamily: KalloTextStyles.sansFamily,
                        fontSize: 12,
                        fontWeight: FontWeight.w400,
                        color: kInkMuted,
                      ),
                    ),
                  ),
                if (onboardingIncomplete)
                  const Positioned(top: 0, right: 0, child: OnboardingDot()),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
