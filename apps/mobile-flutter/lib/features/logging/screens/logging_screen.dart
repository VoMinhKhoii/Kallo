import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/auth/session_provider.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/feedback/skeleton.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../data/logging_keys.dart';
import '../data/logging_models.dart';
import '../data/logging_providers.dart';
import '../logic/logging_spacing.dart';
import '../widgets/feed/feed_area.dart';
import '../widgets/timeline/partial_yesterday_prompt.dart';
import '../widgets/timeline/timeline_picker.dart';

/// The logging tab. Owns the selected date + picker-expanded state so the date
/// strip (in the header) and the feed share one source of truth — mirrors the
/// RN `LoggingScreen` and the web `LoggingShell`'s `selectedDate`.
///
/// Ported 1:1 from `apps/mobile/src/app/(app)/(tabs)/logging.tsx`.
class LoggingScreen extends ConsumerStatefulWidget {
  const LoggingScreen({super.key});

  @override
  ConsumerState<LoggingScreen> createState() => _LoggingScreenState();
}

class _LoggingScreenState extends ConsumerState<LoggingScreen> {
  late String _selectedDate = todayDateString();
  bool _pickerExpanded = false;

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(currentSessionProvider);
    final userId = session?.user.id;

    if (userId == null) {
      return _centered(
        Text('common.notSignedIn'.tr(), style: dashMeta(),),
      );
    }

    final profileAsync = ref.watch(loggingProfileProvider);
    final mealDates =
        ref.watch(mealDatesProvider(userId)).valueOrNull ?? const <String>[];

    if (profileAsync.isLoading) {
      return const _LoggingSkeleton();
    }

    final data = profileAsync.valueOrNull;
    // Defaults mirror the web's DEFAULT_PROFILE so an incomplete-onboarding
    // profile shows sensible targets, never /0g.
    final profile = LoggingProfile(
      userId: userId,
      calorieTarget: (data?['calorieTarget'] as num?)?.toInt() ?? 2000,
      proteinTargetG: (data?['proteinTargetG'] as num?)?.toInt() ?? 150,
      carbsTargetG: (data?['carbsTargetG'] as num?)?.toInt() ?? 250,
      fatTargetG: (data?['fatTargetG'] as num?)?.toInt() ?? 65,
    );
    final today = todayDateString();
    final yesterday = addDays(today, -1);

    // A meal composed on the dashboard means TODAY. This screen lives in an
    // indexedStack branch, so [_selectedDate] survives tab switches — page back
    // to last Tuesday, hop to the dashboard, log from the FAB, and without this
    // the feed would claim the text and analyze it against last Tuesday.
    //
    // A plain assignment, not setState: we are already inside the build this
    // provider triggered, and the new value is consumed a few lines down, so
    // FeedArea is constructed with today on this very frame — before it can
    // claim the parked meal.
    if (ref.watch(pendingMealProvider) != null && _selectedDate != today) {
      _selectedDate = today;
    }

    // The date chip MORPHS in place into the week strip (fixed height, so the
    // feed never shifts) — a buttery cross-dissolve, not a panel that opens
    // below. The scrim catches outside-taps to collapse back to the chip.
    //
    // [Screen] (not a bare ColoredBox + SafeArea) because it also carries the
    // tap-anywhere-to-unfocus gesture every other surface gets: the composer's
    // keyboard used to stay up forever, since nothing on this tab dropped focus
    // on a background tap. Interactive descendants — the feed's cards, the
    // composer, and the picker scrim below — win their own taps in the gesture
    // arena, so only genuinely empty surface dismisses.
    return Screen(
      bottom: false,
      child: Column(
        children: [
          Padding(
            // No bottom inset — the macro summary below owns the one
            // block gap, so the date strip never double-spaces it.
            padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
            child: DateMorph(
              dates: mealDates,
              today: today,
              selectedDate: _selectedDate,
              expanded: _pickerExpanded,
              onSelectDate: (date) => setState(() => _selectedDate = date),
              onExpand: () => setState(() => _pickerExpanded = true),
              onCollapse: () => setState(() => _pickerExpanded = false),
            ),
          ),
          // A once-daily nudge when *yesterday* was under-logged — only while
          // viewing today, and only until dismissed this session.
          if (_selectedDate == today &&
              !ref.watch(yesterdayPromptDismissedProvider(yesterday)))
            PartialYesterdayPrompt(
              userId: userId,
              yesterday: yesterday,
              calorieTarget: profile.calorieTarget,
              onOpenDay: (date) => setState(() => _selectedDate = date),
            ),
          Expanded(
            child: Stack(
              children: [
                Positioned.fill(
                  child: FeedArea(profile: profile, date: _selectedDate),
                ),
                if (_pickerExpanded)
                  Positioned.fill(
                    child: GestureDetector(
                      behavior: HitTestBehavior.translucent,
                      onTap: () => setState(() => _pickerExpanded = false),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _centered(Widget child) {
    return ColoredBox(
      color: KalloColors.surface,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(KalloSpacing.sp6),
          child: Center(child: child),
        ),
      ),
    );
  }
}

/// Profile-load skeleton mirroring the logging tab: a date-chip header, then a
/// stack of feed-ish meal blocks.
class _LoggingSkeleton extends StatelessWidget {
  const _LoggingSkeleton();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: tr('common.loading'),
      child: ColoredBox(
        color: KalloColors.surface,
        child: SafeArea(
          bottom: false,
          child: SkeletonPulse(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Padding(
                  padding: EdgeInsets.fromLTRB(
                    KalloSpacing.sp3,
                    LoggingSpacing.block,
                    KalloSpacing.sp3,
                    LoggingSpacing.block,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      SkeletonBar(width: 132, height: 20, radius: 10),
                      SkeletonBar(width: 40, height: 20, radius: 10),
                    ],
                  ),
                ),
                for (var i = 0; i < 3; i++)
                  const Padding(
                    padding: EdgeInsets.fromLTRB(
                      KalloSpacing.sp3,
                      0,
                      KalloSpacing.sp3,
                      LoggingSpacing.block,
                    ),
                    child: SkeletonBar(height: 96, radius: 16),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
