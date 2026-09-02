import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// A quiet line under the nutrient grid attributing the daily targets to
/// recognized reference intakes (WHO/FAO · Vietnam RDA · NASEM DRI). Tapping it
/// opens the full citations — the "these are reliable sources" affordance.
class SourceAttribution extends StatelessWidget {
  const SourceAttribution({super.key});

  @override
  Widget build(BuildContext context) {
    // A tappable line still owes the finger 44pt, even where its glyphs are 13
    // because they sit inside a text run.
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _showCitations(context),
      child: Container(
        constraints: const BoxConstraints(minHeight: 44),
        alignment: Alignment.center,
        child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            LucideIcons.shieldCheck300,
            size: 13,
            color: kInkMuted,
          ),
          const SizedBox(width: KalloSpacing.sp1_5),
          Flexible(
            child: Text(
              tr('nutrition.sources.caption'),
              textAlign: TextAlign.center,
              style: dashMeta(color: kInkMuted),
            ),
          ),
          const SizedBox(width: KalloSpacing.sp1),
          const Icon(LucideIcons.info300, size: 13, color: kInkMuted),
        ],
        ),
      ),
    );
  }
}

void _showCitations(BuildContext context) {
  final bottomInset = MediaQuery.of(context).padding.bottom;
  showNhamSheet<void>(
    context,
    builder: (_) => KalloSheetSurface(
      // Citation list grows with the data source count — scroll, don't clip.
      scrollable: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          KalloSheetHeader(title: tr('nutrition.sources.title')),
          Padding(
            padding: EdgeInsets.fromLTRB(
              KalloSpacing.sp5,
              KalloSpacing.sp1,
              KalloSpacing.sp5,
              bottomInset + KalloSpacing.sp5,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tr('nutrition.sources.intro'), style: dashMeta()),
                const SizedBox(height: KalloSpacing.sp4),
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
      padding: const EdgeInsets.only(bottom: KalloSpacing.sp3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: kSectionHeader()),
          const SizedBox(height: 2),
          Text(detail, style: dashMeta(color: kInkMuted)),
        ],
      ),
    );
  }
}
