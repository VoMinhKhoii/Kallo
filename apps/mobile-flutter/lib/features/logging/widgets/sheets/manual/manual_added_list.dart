import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../models/nutrition/ingredient.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import 'manual_gram_field.dart';

/// The picked ingredients, as one hairline card of 64pt rows: name 14 ink over
/// a 12 muted kcal subtitle, the tappable gram field, and a 44pt remove target
/// (native pass, 2026-08-31 — the old bordered per-item tiles are retired).
class ManualAddedList extends StatelessWidget {
  const ManualAddedList({
    super.key,
    required this.items,
    required this.disabled,
    required this.onGramsChange,
    required this.onRemove,
  });

  final List<ManualLogItem> items;
  final bool disabled;
  final void Function(String itemId, double? grams) onGramsChange;
  final ValueChanged<String> onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(KalloRadii.containerLg),
        border: Border.all(color: kHairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const ColoredBox(color: kHairline, child: SizedBox(height: 1)),
            _AddedRow(
              key: ValueKey(items[i].id),
              item: items[i],
              disabled: disabled,
              onGramsChange: (grams) => onGramsChange(items[i].id, grams),
              onRemove: () => onRemove(items[i].id),
            ),
          ],
        ],
      ),
    );
  }
}

class _AddedRow extends StatelessWidget {
  const _AddedRow({
    super.key,
    required this.item,
    required this.disabled,
    required this.onGramsChange,
    required this.onRemove,
  });

  final ManualLogItem item;
  final bool disabled;
  final ValueChanged<double?> onGramsChange;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final kcal = item.macros?.caloriesKcal;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 64),
      child: Row(
        children: [
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.ingredient.namePrimary,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: dashBody(),
                ),
                const SizedBox(height: 2),
                Text(
                  kcal == null
                      ? '—'
                      : '${kcal.round()} ${'logging.manualLogging.kcal'.tr()}',
                  style: dashMeta(tabular: true),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Semantics(
            label: 'logging.manualLogging.editGrams'.tr(),
            child: ManualGramField(
              grams: item.grams,
              enabled: !disabled,
              onChanged: onGramsChange,
            ),
          ),
          // 44pt target, glyph 18 — the remove-X is quiet by design; the
          // destructive weight lives in what it removes, not in the mark.
          SizedBox(
            width: 44,
            height: 44,
            child: IconButton(
              padding: EdgeInsets.zero,
              onPressed: disabled ? null : onRemove,
              icon: const Icon(LucideIcons.x300, size: 18),
              color: KalloColors.textMuted,
              tooltip: 'logging.manualLogging.removeItem'.tr(),
            ),
          ),
        ],
      ),
    );
  }
}
