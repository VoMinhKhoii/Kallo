/// SectionState — the dashboard's shared loading / error / empty card.
///
/// Split out of the retired `chrome/section_header.dart`: the uppercase
/// `SectionHeader` it shared a file with was replaced app-wide by
/// [SectionHeaderRow] in the native pass (2026-08-31), and this card is what
/// was left.
library;

import 'package:flutter/material.dart';

import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/calm_tokens.dart';
import '../../logic/dashboard_spacing.dart';

/// A centered white card with a glyph, a muted message and one optional
/// action — the in-app beige primary, per the native pass's button tiers.
class SectionState extends StatelessWidget {
  const SectionState({
    super.key,
    required this.message,
    this.actionLabel,
    this.onAction,
    this.icon,
  });

  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// Optional glyph shown above the message (e.g. a cloud-off for errors).
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final hasAction = actionLabel != null && onAction != null;
    return KalloCard(
      padding: DashboardSpacing.card,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 180),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: kTrack,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: KalloIcons.size, color: kInkMuted),
              ),
              const SizedBox(height: DashboardSpacing.section),
            ],
            Text(
              message,
              textAlign: TextAlign.center,
              style: dashBody(color: kInkMuted),
            ),
            if (hasAction) ...[
              const SizedBox(height: DashboardSpacing.section),
              KalloButton(title: actionLabel!, onPressed: onAction),
            ],
          ],
        ),
      ),
    );
  }
}
