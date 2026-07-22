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
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/dashboard.dart';
import '../../../shared/widgets/widgets.dart';
import '../widgets/card_skeletons.dart';
import '../../../data/session_provider.dart';
import '../../../shell/app_header.dart';
import '../../../theme/nham_theme.dart';
import '../../logging/logic/timeline_utils.dart' hide WeekStrip;
import '../data/dashboard_providers.dart';
import '../logic/dashboard_format.dart';
import '../widgets/adherence_heatmap.dart';
import '../../../theme/calm_tokens.dart';
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
              child: Text(_greeting().tr(), style: dashHeadline()),
            ),
          ),
          Expanded(
            child: bundle.when(
              // Skeleton of the real layout (not a centered spinner) so the
              // load previews its own shape. One outer pulse so the nested
              // per-card pulses collapse in phase (see SkeletonPulse).
              loading: () => const SkeletonPulse(child: _DashboardSkeleton()),
              error: (_, __) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(NhamSpacing.sp6),
                  child: SectionState(
                    icon: LucideIcons.cloudOff,
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
                isFirstRun: _isFirstRun(data),
              ),
            ),
          ),
        ],
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
    required this.isFirstRun,
  });

  /// Today-anchored args — Progress (30d), Consistency (90d) and the week
  /// strip's rings stay "as of today" regardless of the selected day.
  final DashboardArgs args;
  final String todayDate;
  final DockTargets targets;
  final bool isFirstRun;

  @override
  State<_Content> createState() => _ContentState();
}

class _ContentState extends State<_Content> {
  /// The browsable days, oldest → today (future days aren't pageable). Today is
  /// always the last page; the strip centers today at index 3, so the past half
  /// (indices 0..3) is exactly today and the three days before it.
  late final List<String> _days =
      buildCenteredStripFromAnchor(widget.todayDate).days.sublist(0, 4);
  late final int _todayPage = _days.length - 1;

  // The day whose summary the Today card shows; tapping a strip day or swiping
  // the card changes it. Defaults to today (the last page).
  late int _page = _todayPage;
  late final PageController _pageController =
      PageController(initialPage: _todayPage);

  String get _selectedDate => _days[_page];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  /// Strip tap → animate the day card to that page (selection haptic fires in
  /// the strip's own GestureDetector). Future / out-of-window days are ignored.
  void _onSelectDay(String date) {
    final idx = _days.indexOf(date);
    if (idx < 0 || idx == _page) return;
    _pageController.animateToPage(
      idx,
      duration: const Duration(milliseconds: 280),
      curve: const Cubic(0.16, 1, 0.3, 1),
    );
  }

  /// Swipe → update selection + fire the same selection haptic the strip uses.
  void _onPageChanged(int page) {
    if (page == _page) return;
    HapticFeedback.selectionClick();
    setState(() => _page = page);
  }

  /// A human date line for the card: "Today" / "Yesterday" / a localized
  /// weekday-month-day (e.g. "Mon, Jun 9").
  String _dateLabel(String date, String locale) {
    if (date == widget.todayDate) return tr('dashboard.today');
    if (date == addDays(widget.todayDate, -1)) {
      return tr('dashboard.yesterday');
    }
    return DateFormat('EEE, MMM d', locale).format(dateStringToDate(date));
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    final locale = context.locale.toString();

    return Stack(
      children: [
        ListView(
          padding: EdgeInsets.only(
            left: NhamSpacing.sp3,
            right: NhamSpacing.sp3,
            top: NhamSpacing.sp2,
            // Clear the FAB's resting footprint (44 + 20 bottom) with a small
            // gap — no more than that, so the scroll doesn't end in dead space.
            bottom: bottomInset + 76,
          ),
          children: [
            // SECTION 1 — week strip + the paged day-viewer (greeting now lives
            // in the header row, beside the hamburger).
            WeekStrip(
              args: widget.args,
              todayDate: widget.todayDate,
              selectedDate: _selectedDate,
              onSelectDay: _onSelectDay,
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: NhamSpacing.sp3),
              child: widget.isFirstRun
                  ? TodaySection(
                      args: widget.args,
                      targets: widget.targets,
                      dateLabel: _dateLabel(widget.todayDate, locale),
                      isFirstRun: true,
                    )
                  : _DayPager(
                      controller: _pageController,
                      days: _days,
                      todayPage: _todayPage,
                      userId: widget.args.userId,
                      targets: widget.targets,
                      onPageChanged: _onPageChanged,
                      dateLabel: (d) => _dateLabel(d, locale),
                    ),
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
            // SECTION 3 — Consistency. Last section: no trailing margin, so the
            // scroll ends right under the heatmap instead of a dead gap.
            _Section(
              last: true,
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

/// The paged day-viewer: a PageView of [TodaySection]s, one per browsable day,
/// synced to the week strip. Swiping or tapping a strip day moves the page.
///
/// A PageView needs a bounded height, but each day's card differs in height
/// (different meal counts). Each page reports its measured height; the pager
/// animates its own height to the active page so the surrounding ListView
/// reflows smoothly instead of the card being clipped or over-tall.
class _DayPager extends StatefulWidget {
  const _DayPager({
    required this.controller,
    required this.days,
    required this.todayPage,
    required this.userId,
    required this.targets,
    required this.onPageChanged,
    required this.dateLabel,
  });

  final PageController controller;
  final List<String> days;
  final int todayPage;
  final String userId;
  final DockTargets targets;
  final ValueChanged<int> onPageChanged;
  final String Function(String date) dateLabel;

  @override
  State<_DayPager> createState() => _DayPagerState();
}

class _DayPagerState extends State<_DayPager> {
  late final List<double?> _heights =
      List<double?>.filled(widget.days.length, null);
  late int _active = widget.todayPage;

  void _report(int index, double height) {
    if (_heights[index] == height) return;
    // Defer the setState out of the layout/build phase.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() => _heights[index] = height);
    });
  }

  @override
  Widget build(BuildContext context) {
    // While a page is unmeasured, fall back to the tallest known height (or a
    // sensible minimum) so the first frame isn't zero-height.
    final known = _heights.whereType<double>();
    final fallback = known.isEmpty
        ? 280.0
        : known.reduce((a, b) => a > b ? a : b);
    final height = _heights[_active] ?? fallback;

    return AnimatedSize(
      duration: const Duration(milliseconds: 220),
      curve: const Cubic(0.16, 1, 0.3, 1),
      alignment: Alignment.topCenter,
      child: SizedBox(
        height: height,
        child: PageView.builder(
          controller: widget.controller,
          itemCount: widget.days.length,
          onPageChanged: (p) {
            setState(() => _active = p);
            widget.onPageChanged(p);
          },
          itemBuilder: (context, index) {
            final date = widget.days[index];
            return _MeasuredPage(
              onHeight: (h) => _report(index, h),
              child: TodaySection(
                args: (userId: widget.userId, date: date),
                targets: widget.targets,
                dateLabel: widget.dateLabel(date),
                isToday: index == widget.todayPage,
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Reports its child's laid-out height once per layout pass, top-aligned so the
/// card sits at the top of the (taller) page viewport.
class _MeasuredPage extends StatelessWidget {
  const _MeasuredPage({required this.child, required this.onHeight});
  final Widget child;
  final ValueChanged<double> onHeight;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      physics: const NeverScrollableScrollPhysics(),
      child: _SizeReporter(
        onHeight: onHeight,
        child: child,
      ),
    );
  }
}

class _SizeReporter extends SingleChildRenderObjectWidget {
  const _SizeReporter({required this.onHeight, required super.child});
  final ValueChanged<double> onHeight;

  @override
  _SizeReporterRender createRenderObject(BuildContext context) =>
      _SizeReporterRender(onHeight);

  @override
  void updateRenderObject(
      BuildContext context, _SizeReporterRender renderObject) {
    renderObject.onHeight = onHeight;
  }
}

class _SizeReporterRender extends RenderProxyBox {
  _SizeReporterRender(this.onHeight);
  ValueChanged<double> onHeight;
  double? _last;

  @override
  void performLayout() {
    super.performLayout();
    final h = size.height;
    if (h != _last) {
      _last = h;
      onHeight(h);
    }
  }
}

/// The full-page loading skeleton — a week-strip row, the Today card, and the
/// two lower section cards, all under one shimmer sweep. Mirrors [_Content]'s
/// padding so the swap to real data doesn't jump.
class _DashboardSkeleton extends StatelessWidget {
  const _DashboardSkeleton();

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    // The pulse comes from the caller (one outer SkeletonPulse); every card /
    // header / bar below inherits it and fades in phase.
    return ListView(
      padding: EdgeInsets.only(
        left: NhamSpacing.sp3,
        right: NhamSpacing.sp3,
        top: NhamSpacing.sp3,
        bottom: bottomInset + 76,
      ),
      children: const [
        // Week-strip row — four day pills.
        Padding(
          padding: EdgeInsets.symmetric(vertical: NhamSpacing.sp2),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              SkeletonBar(width: 64, height: 76, radius: 16),
              SkeletonBar(width: 64, height: 76, radius: 16),
              SkeletonBar(width: 64, height: 76, radius: 16),
              SkeletonBar(width: 64, height: 76, radius: 16),
            ],
          ),
        ),
        SizedBox(height: NhamSpacing.sp3),
        // Section 1 — Today.
        SkeletonHeader(),
        TodayCardSkeleton(),
        SizedBox(height: NhamSpacing.sp4),
        // Section 2 — Progress.
        SkeletonHeader(),
        WeightCardSkeleton(),
        SizedBox(height: NhamSpacing.sp4),
        // Section 3 — Consistency.
        SkeletonHeader(),
        SkeletonCard(children: [
          SkeletonBar(height: 120, radius: 10),
        ]),
      ],
    );
  }
}

/// A dashboard section: `mb-4 gap-1.5` (16px bottom margin, 6px inner gap). The
/// final section passes [last] to drop the bottom margin.
class _Section extends StatelessWidget {
  const _Section({required this.children, this.last = false});
  final List<Widget> children;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : NhamSpacing.sp3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(height: NhamSpacing.sp3),
            children[i],
          ],
        ],
      ),
    );
  }
}
