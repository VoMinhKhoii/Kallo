/// SectionState — the dashboard's shared error state.
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

/// The shared surface state, straight on the canvas: the hedgehog stuck in a
/// jar, the reason a section would not load, and one retry.
///
/// No card. It used to sit in a white one, which on the screen-level failure
/// was a lone white slab floating mid-page — a box around nothing, reading as
/// a broken widget rather than an empty page. The Today section it stands in
/// for lives on the canvas too (the dial and macros carry no card), and the
/// Log feed's failure already sat bare; this matches both.
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
    return KalloSurfaceState(
      area: SurfaceArea.dashboard,
      kind: SurfaceKind.error,
      compact: compact,
      minHeight: compact ? 180 : null,
      title: tr('dashboard.sectionErrorTitle'),
      subtitle: message,
      action:
          hasAction
              ? KalloButton(
                title: actionLabel!,
                variant: KalloButtonVariant.cta,
                onPressed: onAction,
              )
              : null,
    );
  }
}
