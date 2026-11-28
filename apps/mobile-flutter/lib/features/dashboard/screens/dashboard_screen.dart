/// DashboardScreen — RN port of `app/(app)/(tabs)/dashboard.tsx`.
///
/// A vertically scrolling stack of the three web sections, in the web's order:
///   1. TODAY SUMMARY  — week title + the calorie-ring / macros / meals dock
///   2. PROGRESS       — "Progress" + 30-day badge + the WeightChart card
///   3. CONSISTENCY    — "Consistency" + 90-day badge + AdherenceHeatmap
///
/// One aggregate fetch ([dashboardBundleProvider]) seeds the per-section
/// providers; sections render only after it resolves, so they hit the warm
/// cache (one request, one cold-start). Mobile deviations match the RN plan:
/// the range badges are passive labels, fixed at 30d/90d.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/profile/dashboard.dart';
import '../../../shared/widgets/feedback/skeleton.dart';
import '../../../shared/widgets/surface/kallo_screen.dart';
import '../widgets/states/card_skeletons.dart';
import '../widgets/states/section_state.dart';
import '../../../services/auth/session_provider.dart';
import '../../../theme/kallo_theme.dart';
import '../data/dashboard_providers.dart';
import '../../../shared/logic/display_format.dart';
import '../../../theme/calm_tokens.dart';
import '../widgets/today/dock_targets.dart';
import 'dashboard_content.dart';
import '../widgets/chrome/dashboard_frame.dart';
import '../widgets/chrome/dashboard_header.dart';
import '../widgets/states/dashboard_failure.dart';

// EN copy (messages/en.json `dashboard.*`), matching the RN inlined COPY.

// Web DEFAULT_PROFILE fallbacks so an incomplete-onboarding profile never /0g.
const _defaultCalorieTarget = 2000.0;
const _defaultProteinTargetG = 150.0;
const _defaultCarbsTargetG = 250.0;
const _defaultFatTargetG = 65.0;

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(currentSessionProvider);
    final userId = session?.user.id;

    if (userId == null) {
      return Screen(
        glow: true,
        bottom: false,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(KalloSpacing.sp6),
            child: Text(
              tr('common.notSignedIn'),
              style: dashBody(color: kInkMuted),
            ),
          ),
        ),
      );
    }

    final todayDate = todayDateString();
    final args = (userId: userId, date: todayDate);
    final bundle = ref.watch(dashboardBundleProvider(args));
    // Awaiting the refetch is what makes the spinner honest: it lives exactly
    // as long as the load it stands for. The skeleton pulls the same one — a
    // first load that hangs is where a pull is most wanted.
    Future<void> refresh() => ref.refresh(dashboardBundleProvider(args).future);

    return Screen(
      glow: true,
      bottom: false,
      bounded: true,
      child: DashboardFrame(
        header: const DashboardHeader(),
        child: bundle.when(
          // Skeleton of the real layout, not a spinner, so the load previews
          // its own shape; one outer pulse keeps nested pulses in phase.
          loading:
              () => SkeletonPulse(child: DashboardSkeleton(onRefresh: refresh)),
          error:
              (_, __) => DashboardFailure(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(KalloSpacing.sp6),
                    child: SectionState(
                      compact: false,
                      message: tr('dashboard.todayLoadError'),
                      actionLabel: tr('dashboard.retry'),
                      onAction:
                          () => ref.invalidate(dashboardBundleProvider(args)),
                    ),
                  ),
                ),
              ),
          data:
              (data) => DashboardContent(
                args: args,
                todayDate: todayDate,
                targets: _targetsFor(data),
                isFirstRun: _isFirstRun(data),
                onRefresh: refresh,
              ),
        ),
      ),
    );
  }

  /// True when the user looks brand-new — so the dashboard can collapse to
  /// the one first-run card and suppress the "% on track" framing.
  ///
  /// There is no explicit "has-logged-before" flag on the bundle, so this gates
  /// on "zero meals today AND zero logged/partial heatmap cells in the 90d
  /// window". Known limit: a returning user whose last meal is older than 90
  /// days has no cells in the window and IS treated as first-run — acceptable,
  /// since after that long a gentle restart reads better than stale framing.
  bool _isFirstRun(DashboardBundle data) {
    if (data.day.persistedMeals.isNotEmpty) return false;
    for (final row in data.heatmap.cells) {
      for (final cell in row) {
        if (cell.status == HeatmapCellStatus.logged ||
            cell.status == HeatmapCellStatus.partial) {
          return false;
        }
      }
    }
    return true;
  }

  DockTargets _targetsFor(DashboardBundle data) {
    final p = data.profile;
    return DockTargets(
      calorieTarget: p?.calorieTarget ?? _defaultCalorieTarget,
      proteinTargetG: p?.proteinTargetG ?? _defaultProteinTargetG,
      carbsTargetG: p?.carbsTargetG ?? _defaultCarbsTargetG,
      fatTargetG: p?.fatTargetG ?? _defaultFatTargetG,
      // Null until onboarding sets it; the dial reads that as counting up.
      goal: p?.goal,
    );
  }
}
