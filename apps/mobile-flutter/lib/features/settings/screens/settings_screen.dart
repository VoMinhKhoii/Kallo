import 'dart:ui';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../data/session_provider.dart';
import '../../../shared/widgets/nham_primitives.dart';
import '../../../shell/app_header.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/profile_providers.dart';
import '../widgets/profile_form.dart';
import 'account_section.dart';

/// Settings tab — two-level nav (list → profile drill-in), mirroring the RN
/// expo-router stack inside the settings tab. A nested [Navigator] owns the
/// drill-in so the single contract route `/settings` keeps one screen widget.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Navigator(
      onGenerateRoute:
          (settings) => MaterialPageRoute<void>(
            settings: settings,
            builder: (_) => const _SettingsList(),
          ),
    );
  }
}

/// Settings list view — mirrors the web sidebar's drill-in nav. Tap "Profile"
/// to push the profile editor onto the (nested) stack.
class _SettingsList extends StatelessWidget {
  const _SettingsList();

  @override
  Widget build(BuildContext context) {
    return Screen(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: NhamSpacing.sp3),
            child: AppHeader(),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                NhamSpacing.sp4,
                NhamSpacing.sp2,
                NhamSpacing.sp4,
                0,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    // Web sidebar h2: text-lg (18) font-medium tracking-tight,
                    // Lora.
                    tr('settings.title'),
                    style: NhamTextStyles.serifMedium(
                      fontSize: NhamFontSize.lg,
                    ).copyWith(
                      letterSpacing: NhamTracking.tight,
                      color: NhamColors.text,
                    ),
                  ),
                  const SizedBox(height: NhamSpacing.sp4),
                  _ProfileRowTile(
                    onTap:
                        () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => const _ProfileScreen(),
                          ),
                        ),
                  ),
                  const SizedBox(height: NhamSpacing.sp5),
                  const AccountSection(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileRowTile extends StatefulWidget {
  const _ProfileRowTile({required this.onTap});
  final VoidCallback onTap;

  @override
  State<_ProfileRowTile> createState() => _ProfileRowTileState();
}

class _ProfileRowTileState extends State<_ProfileRowTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: Container(
        // Web nav item: no border. rounded-xl px-3 py-2.5 gap-2.5, inactive
        // text-muted, on press hover/50 fill + text darkens to text.
        padding: const EdgeInsets.symmetric(
          horizontal: NhamSpacing.sp3,
          vertical: 10, // py-2.5
        ),
        decoration: BoxDecoration(
          color: _pressed ? NhamColors.hover50 : Colors.transparent,
          borderRadius: BorderRadius.circular(NhamRadii.buttonXl), // rounded-xl
        ),
        child: Row(
          children: [
            Icon(
              Icons.person_outline,
              size: 16,
              color: _pressed ? NhamColors.text : NhamColors.textMuted,
            ),
            const SizedBox(width: 10), // gap-2.5
            Expanded(
              child: Text(
                tr('settings.sidebar.profile'),
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.sm,
                ).copyWith(
                  color: _pressed ? NhamColors.text : NhamColors.textMuted,
                ),
              ),
            ),
            // ChevronRight inactive = text-muted/50.
            const Icon(
              Icons.chevron_right,
              size: 16,
              color: NhamColors.textMuted50,
            ),
          ],
        ),
      ),
    );
  }
}

/// Profile editor screen — pushed from the settings list. Back header mirrors
/// the web shell's ArrowLeft + "Settings" link.
class _ProfileScreen extends ConsumerWidget {
  const _ProfileScreen();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(currentSessionProvider);
    final userId = session?.user.id;
    final profileAsync = ref.watch(profileProvider(userId != null));

    return Screen(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Back header — bg-[#FDFCF8]/90 backdrop-blur-sm, border-b.
          const _BackHeader(),
          Expanded(
            child:
                userId == null
                    ? _Centered(
                      child: Text(
                        tr('common.notSignedIn'),
                        style: NhamTextStyles.bodySmall().copyWith(
                          color: NhamColors.text,
                        ),
                      ),
                    )
                    : profileAsync.when(
                      loading:
                          () => const _Centered(
                            child: CircularProgressIndicator(
                              valueColor: AlwaysStoppedAnimation(
                                NhamColors.accent,
                              ),
                            ),
                          ),
                      error: (_, __) => const _ProfileEmpty(),
                      data:
                          (profile) =>
                              profile != null
                                  ? ProfileForm(profile: profile)
                                  : const _ProfileEmpty(),
                    ),
          ),
        ],
      ),
    );
  }
}

class _Centered extends StatelessWidget {
  const _Centered({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(NhamSpacing.sp6),
      child: child,
    ),
  );
}

/// Empty state when no profile exists yet (onboarding never ran).
class _ProfileEmpty extends StatelessWidget {
  const _ProfileEmpty();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp5),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr('settings.profilePage.emptyTitle'),
            style: NhamTextStyles.serifMedium(
              fontSize: NhamFontSize.h3,
            ).copyWith(
              letterSpacing: NhamTracking.tight,
              color: NhamColors.text,
            ),
          ),
          const SizedBox(height: NhamSpacing.sp4),
          Text(
            tr('settings.profilePage.emptyDescription'),
            style: NhamTextStyles.sansRegular(
              fontSize: NhamFontSize.sm,
            ).copyWith(height: 22 / 14, color: NhamColors.textWarm),
          ),
          const SizedBox(height: NhamSpacing.sp4),
          // RN routes "Start setup" to /logging (where the onboarding overlay
          // resumes). go_router resolves via the root navigator from any
          // descendant context, so this crosses tabs correctly.
          Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              onTap: () => context.go('/logging'),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: NhamSpacing.sp5,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: NhamColors.text,
                  borderRadius: BorderRadius.circular(NhamRadii.pill),
                ),
                child: Text(
                  tr('settings.profilePage.startSetup'),
                  style: NhamTextStyles.sansMedium(
                    fontSize: NhamFontSize.sm,
                  ).copyWith(color: Colors.white),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sticky back header — mirrors the web shell's translucent cream/90 bar with
/// a backdrop blur, a bottom border, and the ArrowLeft + "Settings" link whose
/// text darkens (textWarm → text) on press.
class _BackHeader extends StatefulWidget {
  const _BackHeader();

  @override
  State<_BackHeader> createState() => _BackHeaderState();
}

class _BackHeaderState extends State<_BackHeader> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final color = _pressed ? NhamColors.text : NhamColors.textWarm;
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8), // backdrop-blur-sm
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => Navigator.of(context).pop(),
          onTapDown: (_) => setState(() => _pressed = true),
          onTapUp: (_) => setState(() => _pressed = false),
          onTapCancel: () => setState(() => _pressed = false),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp4,
              vertical: NhamSpacing.sp3,
            ),
            decoration: const BoxDecoration(
              color: Color(0xE6FDFCF8), // cream @ 90%
              border: Border(bottom: BorderSide(color: NhamColors.inputBorder)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.arrow_back, size: 16, color: color),
                const SizedBox(width: 6), // gap-1.5
                Text(
                  tr('settings.title'),
                  style: NhamTextStyles.sansMedium(
                    fontSize: NhamFontSize.sm,
                  ).copyWith(color: color),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
