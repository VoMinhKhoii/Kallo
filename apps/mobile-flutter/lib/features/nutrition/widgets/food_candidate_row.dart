import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../features/dashboard/widgets/dashboard_tokens.dart';
import '../providers/candidates_response.dart';

/// A food-source candidate rendered as a FULL row — name, serving, rationale,
/// and (when present) a caution note. The API ships all four per Vietnamese
/// food (`candidates.<nutrient>.<id>.{name,serving,rationale,caution}`); the
/// overview screen only renders name-only pills, so the detail route surfaces
/// the real content the audit calls "the App-Store-feature screen".
///
/// Re-tokened on `dashboard_tokens`: solid white card, one radius, the 5-size
/// DM Sans scale, three inks. No alpha surfaces, no eyebrow.
class FoodCandidateRow extends StatelessWidget {
  const FoodCandidateRow({super.key, required this.candidate});

  final FoodSourceCandidate candidate;

  @override
  Widget build(BuildContext context) {
    final cautionKey = candidate.cautionKey;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.circular(kCardRadius),
        boxShadow: const [kCardShadow],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Name — the row's one emphasis.
          Text(tr(candidate.nameKey), style: dashBody(weight: FontWeight.w600)),
          const SizedBox(height: 6),
          // Serving — how much, in everyday Vietnamese-meal terms.
          Text(tr(candidate.servingKey), style: dashMeta()),
          const SizedBox(height: 10),
          // Rationale — why this food earns a place.
          Text(
            tr(candidate.rationaleKey),
            style: dashBody(color: kInkSecondary),
          ),
          if (cautionKey != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: kTrack,
                borderRadius: BorderRadius.circular(kCardRadius - 4),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 1),
                    child: Icon(
                      LucideIcons.info,
                      size: 14,
                      color: kInkSecondary,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      tr(cautionKey),
                      style: dashMeta(color: kInkSecondary),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
