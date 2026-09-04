/// SectionState — the dashboard's shared error card.
///
/// Split out of the retired `chrome/section_header.dart`: the uppercase
/// `SectionHeader` it shared a file with was replaced app-wide by
/// [SectionHeaderRow] in the native pass (2026-08-31), and this card is what
/// was left.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../logic/dashboard_spacing.dart';

/// A white card holding the shared surface state: the hedgehog stuck in a jar,
/// the reason a section would not load, and one retry — the in-app beige
/// primary, per the native pass's button tiers.
class SectionState extends StatelessWidget {
  const SectionState({
    super.key,
    required this.message,
    this.actionLabel,
    this.onAction,
    this.compact = true,
  });

  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// In-card sizing by default — a section's error sits inside the dashboard.
  /// The screen-level failure, which owns the whole page, passes false.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final hasAction = actionLabel != null && onAction != null;
    return KalloCard(
      padding: DashboardSpacing.card,
      child: KalloSurfaceState(
        area: SurfaceArea.dashboard,
        kind: SurfaceKind.error,
        compact: compact,
        minHeight: compact ? 180 : null,
        title: tr('dashboard.sectionErrorTitle'),
        subtitle: message,
        action: hasAction
            ? KalloButton(title: actionLabel!, onPressed: onAction)
            : null,
      ),
    );
  }
}
