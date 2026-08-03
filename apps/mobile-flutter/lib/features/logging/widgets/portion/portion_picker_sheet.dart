import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/vessel.dart';
import '../../../../shared/widgets/nham_sheet.dart';
import '../../../../shared/widgets/nham_sheet_header.dart';
import '../../../../shared/widgets/quiet_action_button.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/portion/portion_anchors.dart';
import 'portion_container_body.dart';
import 'portion_piece_body.dart';

/// What the picker commits: the exact previewed grams and the vessel re-pointed
/// to the tier that amount may honestly claim.
class PortionPick {
  final int grams;
  final ClientVessel vessel;

  const PortionPick({required this.grams, required this.vessel});
}

/// Opens the portion picker for one dish: a row of true-to-scale vessel
/// silhouettes (tap to jump to a tier), a slider for fine adjustment, and a
/// live gram/kcal preview. Returns null when dismissed or cancelled.
///
/// Ported from `components/logging/feed/meal-entry/portion/portion-picker.tsx`
/// (the phone branch — web renders a Drawer there and a Popover only on wide
/// screens).
Future<PortionPick?> showPortionPicker(
  BuildContext context, {
  required ClientVessel vessel,
  required int grams,
  required double itemCalories,
  required double itemQuantity,
}) {
  return showNhamSheet<PortionPick>(
    context,
    builder: (context) => _PortionPickerSheet(
      vessel: vessel,
      grams: grams,
      itemCalories: itemCalories,
      itemQuantity: itemQuantity,
    ),
  );
}

class _PortionPickerSheet extends StatefulWidget {
  const _PortionPickerSheet({
    required this.vessel,
    required this.grams,
    required this.itemCalories,
    required this.itemQuantity,
  });

  final ClientVessel vessel;
  final int grams;

  /// The item's calories and grams, kept unreduced so the preview is the web's
  /// `calories * grams / quantity` to the digit. Pre-dividing into a
  /// per-gram rate re-associates the arithmetic and drifts by 1 kcal.
  final double itemCalories;
  final double itemQuantity;

  @override
  State<_PortionPickerSheet> createState() => _PortionPickerSheetState();
}

class _PortionPickerSheetState extends State<_PortionPickerSheet> {
  List<PortionAnchor>? _anchors;
  String? _locale;
  late GramEnvelope _envelope;
  late int _grams;

  /// Anchors are locale-dependent (the tier labels), so they're built in build
  /// rather than initState, where `context.locale` isn't ready — and rebuilt
  /// when the locale changes, so an open sheet can't keep labels in the
  /// language the user just left. The grams the user has dialled in survive.
  void _ensureAnchors(BuildContext context) {
    final locale = context.locale.languageCode == 'vi' ? 'vi' : 'en';
    if (_anchors != null && _locale == locale) return;
    final first = _anchors == null;
    _locale = locale;
    _anchors = buildAnchors(widget.vessel, locale);
    _envelope = gramEnvelope(_anchors!);
    // Open on the item's current amount, clamped into the envelope the picker
    // can actually express.
    if (first) _grams = widget.grams.clamp(_envelope.min, _envelope.max);
  }

  void _apply() {
    Navigator.of(context).pop(
      PortionPick(
        grams: _grams,
        vessel: repointVessel(widget.vessel, _anchors!, _grams),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    _ensureAnchors(context);
    final anchors = _anchors!;
    final title = 'logging.portionPicker.title'.tr();
    final bottomInset = MediaQuery.of(context).padding.bottom;
    final kcal = widget.itemQuantity > 0
        ? (widget.itemCalories * _grams) / widget.itemQuantity
        : 0.0;

    return NhamSheetSurface(
      // Cup glyphs are taller than they are wide, so the container branch runs
      // ~400pt — past a short phone's height, and past every phone's in
      // landscape. Scrollable keeps Cancel/Apply reachable instead of clipped.
      scrollable: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          NhamSheetHeader(title: title),
          Padding(
            padding: EdgeInsets.fromLTRB(
              NhamSpacing.sp4,
              NhamSpacing.sp2,
              NhamSpacing.sp4,
              bottomInset + NhamSpacing.sp4,
            ),
            child: Column(
              children: [
                switch (widget.vessel) {
                  final ContainerVessel v => PortionContainerBody(
                    family: v.family,
                    anchors: anchors,
                    grams: _grams,
                    min: _envelope.min,
                    max: _envelope.max,
                    kcal: kcal,
                    sliderLabel: title,
                    onChanged: (grams) => setState(() => _grams = grams),
                  ),
                  final PieceVessel v => PortionPieceBody(
                    vessel: v,
                    anchors: anchors,
                    grams: _grams,
                    min: _envelope.min,
                    max: _envelope.max,
                    kcal: kcal,
                    sliderLabel: title,
                    onChanged: (grams) => setState(() => _grams = grams),
                  ),
                },
                const SizedBox(height: NhamSpacing.sp4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  spacing: NhamSpacing.sp2,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: Text(
                        'logging.portionPicker.cancel'.tr(),
                        style: dashBody(color: kInkMuted),
                      ),
                    ),
                    QuietActionButton(
                      label: 'logging.portionPicker.apply'.tr(),
                      onTap: _apply,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
