import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../models/nutrition/ingredient.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';

/// One search result: name 14 ink over a 12 muted qualifier line, with a 32px
/// beige add-circle inside a 44pt target (native pass, 2026-08-31).
///
/// Raw/cooked and the "related" marker fold into the subtitle rather than
/// riding as pills beside the name — grams still mean what the row's state
/// says, and the subtitle is where a chooser reads it.
class ManualResultRow extends StatefulWidget {
  const ManualResultRow({
    super.key,
    required this.result,
    required this.onTap,
  });

  final IngredientSearchResult result;
  final VoidCallback onTap;

  @override
  State<ManualResultRow> createState() => _ManualResultRowState();
}

class _ManualResultRowState extends State<ManualResultRow> {
  bool _pressed = false;

  void _onTap() {
    HapticFeedback.selectionClick();
    widget.onTap();
  }

  String get _subtitle {
    final result = widget.result;
    final kcal = result.per100g.caloriesKcal;
    return [
      if (result.nameEn != null && result.nameEn!.isNotEmpty) result.nameEn!,
      (result.state == 'cooked'
              ? 'logging.manualLogging.stateCooked'
              : 'logging.manualLogging.stateRaw')
          .tr(),
      if (kcal != null)
        '${kcal.round()} ${'logging.manualLogging.kcalPer100g'.tr()}',
      if (result.semantic) '≈ ${'logging.manualLogging.relatedMatch'.tr()}',
    ].join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      excludeSemantics: true,
      label: 'logging.manualLogging.addFood'.tr(
        namedArgs: {'name': widget.result.namePrimary},
      ),
      onTap: _onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: _onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeInOut,
          color: _pressed ? KalloColors.hover : Colors.transparent,
          constraints: const BoxConstraints(minHeight: 60),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.result.namePrimary,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: dashBody(),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: dashMeta(),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: KalloSpacing.sp3),
              const SizedBox(
                width: 44,
                height: 44,
                child: Center(child: _AddCircle()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The 32px beige micro add-circle — the same mark the button system gives
/// every in-app primary, shrunk to a row affordance.
class _AddCircle extends StatelessWidget {
  const _AddCircle();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32,
      height: 32,
      decoration: const BoxDecoration(
        color: KalloColors.btnPrimarySoft,
        shape: BoxShape.circle,
      ),
      // Stroke 2.0 (the `400` family): at 18pt inside a filled 32 disc the
      // 1.5 default reads hairline against the beige.
      child: const Icon(
        LucideIcons.plus400,
        size: KalloIcons.tertiary,
        color: kInk,
      ),
    );
  }
}
