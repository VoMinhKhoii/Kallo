/// The dock's first-run collapse — shown only when the user has never logged a
/// meal, anywhere, ever.
///
/// Split out of `today_section.dart`: it shares no layout with the dock (no
/// dial, no macros, no meal list) and is the one editorial moment on the tab,
/// so it was the file's clearest seam.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../logging/data/logging_providers.dart' show pendingMealProvider;
import '../../logic/dashboard_spacing.dart';
import 'fade_in_down.dart';

/// First-run collapse: a single Lora question, no ring, no "% on track", plus
/// three time-of-day-aware suggestion chips that open the meal composer
/// prefilled. Shown only when the user has never logged a meal (zero today
/// AND zero history).
class FirstRunCard extends ConsumerWidget {
  const FirstRunCard({super.key});

  /// Which suggestion set fits the device clock (morning / midday / evening).
  static String _chipBucket() => switch (DateTime.now().hour) {
    < 11 => 'morning',
    < 16 => 'midday',
    _ => 'evening',
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bucket = _chipBucket();
    final suggestions = [
      for (var i = 1; i <= 3; i++) tr('dashboard.firstRunChips.$bucket$i'),
    ];
    // Park the text for the feed to claim, then land on it (as the FAB does).
    void openWithMeal(String meal) {
      ref.read(pendingMealProvider.notifier).state = meal;
      context.go('/logging');
    }

    return FadeInDown(
      child: Container(
        width: double.infinity,
        // Deliberately NOT DashboardSpacing.card: this is the one editorial
        // empty state (serif question + hint + chips) and its air is the point.
        padding: const EdgeInsets.symmetric(
          vertical: KalloSpacing.sp6,
          horizontal: KalloSpacing.sp4,
        ),
        decoration: BoxDecoration(
          color: kCardSurface,
          borderRadius: BorderRadius.circular(kCardRadius),
          boxShadow: kCardShadows,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(tr('dashboard.firstRunQuestion'), style: dashHeadline()),
            const SizedBox(height: DashboardSpacing.row * 2),
            Text(
              tr('dashboard.firstRunHint'),
              style: dashBody(color: kInkMuted),
            ),
            const SizedBox(height: DashboardSpacing.section),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final s in suggestions)
                  _FirstRunChip(label: s, onTap: () => openWithMeal(s)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// A suggestion pill matching the logging empty-state chips: border hairline,
/// pill radius, white fill; pressed → accent-tinged border.
class _FirstRunChip extends StatefulWidget {
  const _FirstRunChip({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  State<_FirstRunChip> createState() => _FirstRunChipState();
}

class _FirstRunChipState extends State<_FirstRunChip> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: _pressed ? KalloColors.border15 : KalloColors.elev,
          borderRadius: BorderRadius.circular(KalloRadii.pill),
          border: Border.all(
            color: _pressed ? KalloColors.accent50 : KalloColors.borderSoft,
          ),
        ),
        child: Text(widget.label, style: dashMeta(color: kInk)),
      ),
    );
  }
}
