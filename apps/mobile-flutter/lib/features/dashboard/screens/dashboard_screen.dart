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

import '../../../shared/widgets/widgets.dart';
import '../../../data/session_provider.dart';
import '../../../shell/app_header.dart';
import '../../../theme/nham_theme.dart';
import '../data/dashboard_providers.dart';
import '../logic/dashboard_format.dart';
import '../widgets/adherence_heatmap.dart';
import '../widgets/dashboard_tokens.dart';
import '../widgets/floating_meal_trigger.dart';
import '../widgets/section_header.dart';
import '../widgets/today_section.dart';
import '../widgets/week_strip.dart';
import '../widgets/weight_chart.dart';

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
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(NhamSpacing.sp6),
            child: NhamText(tr('common.notSignedIn'),
                variant: NhamTextVariant.small),
          ),
        ),
      );
    }

    final todayDate = todayDateString();
    final args = (userId: userId, date: todayDate);
    final bundle = ref.watch(dashboardBundleProvider(args));

    return Screen(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp3),
            child: AppHeader(
              showAvatar: true,
              child: Text(_greeting().tr(), style: dashHeadline()),
            ),
          ),
          Expanded(
            child: bundle.when(
              loading: () => Center(
                child: Padding(
                  padding: const EdgeInsets.all(NhamSpacing.sp6),
                  child: SectionState(message: tr('dashboard.todayLoading')),
                ),
              ),
              error: (_, __) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(NhamSpacing.sp6),
                  child: SectionState(
                    message: tr('dashboard.todayLoadError'),
                    actionLabel: tr('dashboard.retry'),
                    onAction: () =>
                        ref.invalidate(dashboardBundleProvider(args)),
                  ),
                ),
              ),
              data: (data) => _Content(
                args: args,
                todayDate: todayDate,
                targets: _targetsFor(data),
              ),
            ),
          ),
        ],
      ),
    );
  }

  DockTargets _targetsFor(DashboardBundle data) {
    final p = data.profile;
    return DockTargets(
      calorieTarget: p?.calorieTarget ?? _defaultCalorieTarget,
      proteinTargetG: p?.proteinTargetG ?? _defaultProteinTargetG,
      carbsTargetG: p?.carbsTargetG ?? _defaultCarbsTargetG,
      fatTargetG: p?.fatTargetG ?? _defaultFatTargetG,
    );
  }
}

/// The l10n key for a time-of-day greeting, driven by the device clock. A
/// greeting, not an interpretation — the only Lora moment on the screen.
String _greeting() {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'dashboard.greeting.morning';
  if (hour < 17) return 'dashboard.greeting.afternoon';
  if (hour < 21) return 'dashboard.greeting.evening';
  return 'dashboard.greeting.night';
}

class _Content extends StatefulWidget {
  const _Content({
    required this.args,
    required this.todayDate,
    required this.targets,
  });

  /// Today-anchored args — Progress (30d), Consistency (90d) and the week
  /// strip's rings stay "as of today" regardless of the selected day.
  final DashboardArgs args;
  final String todayDate;
  final DockTargets targets;

  @override
  State<_Content> createState() => _ContentState();
}

class _ContentState extends State<_Content> {
  // The day whose summary the Today card shows; tapping a strip day changes it
  // (browse day-card only). Defaults to today.
  late String _selectedDate = widget.todayDate;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    // Today card follows the selected day; everything else stays on today.
    final selectedArgs = (userId: widget.args.userId, date: _selectedDate);

    return Stack(
      children: [
        ListView(
          padding: EdgeInsets.only(
            left: NhamSpacing.sp3,
            right: NhamSpacing.sp3,
            top: NhamSpacing.sp3,
            // pb-24 (96px) to clear the floating FAB.
            bottom: bottomInset + 96,
          ),
          children: [
            // SECTION 1 — week strip + today summary (greeting now lives in the
            // header row, beside the hamburger).
            WeekStrip(
              args: widget.args,
              todayDate: widget.todayDate,
              selectedDate: _selectedDate,
              onSelectDay: (d) => setState(() => _selectedDate = d),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: NhamSpacing.sp4),
              child: TodaySection(args: selectedArgs, targets: widget.targets),
            ),
            // SECTION 2 — Progress.
            _Section(
              children: [
                SectionHeader(
                  title: tr('dashboard.progress'),
                  range: tr('dashboard.ranges.thirtyDays'),
                ),
                WeightChart(todayDate: widget.todayDate, args: widget.args),
              ],
            ),
            // SECTION 3 — Consistency.
            _Section(
              children: [
                SectionHeader(
                  title: tr('dashboard.consistency'),
                  range: tr('dashboard.ranges.ninetyDays'),
                ),
                AdherenceHeatmap(args: widget.args),
              ],
            ),
          ],
        ),
        // Mobile-only FAB (web `md:hidden` FloatingMealTrigger).
        const FloatingMealTrigger(),
      ],
    );
  }
}

/// A dashboard section: `mb-4 gap-1.5` (16px bottom margin, 6px inner gap).
class _Section extends StatelessWidget {
  const _Section({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: NhamSpacing.sp4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(height: 6),
            children[i],
          ],
        ],
      ),
    );
  }
}
