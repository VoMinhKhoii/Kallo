import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/vessel.dart';
import '../../../../shared/widgets/nham_sheet.dart';
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
  required double kcalPerGram,
}) {
  return showNhamSheet<PortionPick>(
    context,
    builder: (context) => _PortionPickerSheet(
      vessel: vessel,
      grams: grams,
      kcalPerGram: kcalPerGram,
    ),
  );
}

class _PortionPickerSheet extends StatefulWidget {
  const _PortionPickerSheet({
    required this.vessel,
    required this.grams,
    required this.kcalPerGram,
  });

  final ClientVessel vessel;
  final int grams;
  final double kcalPerGram;

  @override
  State<_PortionPickerSheet> createState() => _PortionPickerSheetState();
}

class _PortionPickerSheetState extends State<_PortionPickerSheet> {
  List<PortionAnchor>? _anchors;
  late GramEnvelope _envelope;
  late int _grams;

  /// Anchors are locale-dependent (the tier labels), so they're built on the
  /// first build rather than in initState, where `context.locale` isn't ready.
  void _ensureAnchors(BuildContext context) {
    if (_anchors != null) return;
    final locale = context.locale.languageCode == 'vi' ? 'vi' : 'en';
    _anchors = buildAnchors(widget.vessel, locale);
    _envelope = gramEnvelope(_anchors!);
    // Open on the item's current amount, clamped into the envelope the picker
    // can actually express.
    _grams = widget.grams.clamp(_envelope.min, _envelope.max);
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

    return NhamSheetSurface(
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
                    kcal: _grams * widget.kcalPerGram,
                    sliderLabel: title,
                    onChanged: (grams) => setState(() => _grams = grams),
                  ),
                  final PieceVessel v => PortionPieceBody(
                    vessel: v,
                    anchors: anchors,
                    grams: _grams,
                    min: _envelope.min,
                    max: _envelope.max,
                    kcal: _grams * widget.kcalPerGram,
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
