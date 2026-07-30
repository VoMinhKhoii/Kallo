import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/nham_sheet.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';

/// A quiet line under the nutrient grid attributing the daily targets to
/// recognized reference intakes (WHO/FAO · Vietnam RDA · NASEM DRI). Tapping it
/// opens the full citations — the "these are reliable sources" affordance.
class SourceAttribution extends StatelessWidget {
  const SourceAttribution({super.key});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _showCitations(context),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            LucideIcons.shieldCheck300,
            size: 13,
            color: kInkMuted,
          ),
          const SizedBox(width: NhamSpacing.sp1_5),
          Flexible(
            child: Text(
              tr('nutrition.sources.caption'),
              textAlign: TextAlign.center,
              style: dashMeta(color: kInkMuted),
            ),
          ),
          const SizedBox(width: NhamSpacing.sp1),
          const Icon(LucideIcons.info300, size: 13, color: kInkMuted),
        ],
      ),
    );
  }
}

void _showCitations(BuildContext context) {
  final bottomInset = MediaQuery.of(context).padding.bottom;
  showNhamSheet<void>(
    context,
    builder: (_) => NhamSheetSurface(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          NhamSheetHeader(title: tr('nutrition.sources.title')),
          Padding(
            padding: EdgeInsets.fromLTRB(
              NhamSpacing.sp5,
              NhamSpacing.sp1,
              NhamSpacing.sp5,
              bottomInset + NhamSpacing.sp5,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tr('nutrition.sources.intro'), style: dashMeta()),
                const SizedBox(height: NhamSpacing.sp4),
                _Citation(
                  label: tr('nutrition.targetSources.whoFao'),
                  detail: tr('nutrition.sources.whoFao'),
                ),
                _Citation(
                  label: tr('nutrition.targetSources.vietnamRda'),
                  detail: tr('nutrition.sources.vietnamRda'),
                ),
                _Citation(
                  label: tr('nutrition.targetSources.nasem'),
                  detail: tr('nutrition.sources.nasem'),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _Citation extends StatelessWidget {
  const _Citation({required this.label, required this.detail});

  final String label;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: NhamSpacing.sp3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: dashBody(weight: FontWeight.w600)),
          const SizedBox(height: 2),
          Text(detail, style: dashMeta(color: kInkMuted)),
        ],
      ),
    );
  }
}
