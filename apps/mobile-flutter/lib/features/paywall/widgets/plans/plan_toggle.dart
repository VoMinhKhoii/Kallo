import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../shared/widgets/form/segmented/segmented_strip.dart';
import 'gold_surface.dart';

/// Monthly ↔ yearly, on the app's segmented track.
///
/// **Why this is not [SegmentedStrip].** That file is the app's one
/// mode-switch primitive and says so — every other segmented control in the
/// app draws through it, and this one is the documented exception. Its model
/// is ONE white thumb that travels between segments, and this control cannot
/// have one: the yearly half is permanently gold, so a travelling white thumb
/// would cover the gold on arrival, and a thumb that changed colour in flight
/// would be the cross-fade the primitive exists to eliminate. The two designs
/// are incompatible at the model, not at the trim. Anything that is NOT
/// forced by that — the track, the raised-pill shadow, the label tier, the
/// haptic, the a11y shape — is deliberately identical to the primitive's, so
/// the two read as one control family.
///
/// The gold marks the DEAL, not the selection, which is why the same
/// treatment reappears on the buy button below. What marks the selection is
/// elevation: the chosen half is raised (a white pill, or the gold's own
/// glow), and the unchosen gold takes an ink veil so the raised white beside
/// it plainly wins. Two lit objects with nothing separating them is what an
/// untinted gold half produced.
class PlanToggle extends StatelessWidget {
  const PlanToggle({
    required this.monthlyLabel,
    required this.yearlyLabel,
    required this.yearly,
    required this.onChanged,
    super.key,
  });

  final String monthlyLabel;
  final String yearlyLabel;

  /// True when the yearly plan is the selected one.
  final bool yearly;

  /// Null while a purchase is in flight — the labels stay put and only the
  /// taps stop, so the row does not reflow mid-transaction.
  final ValueChanged<bool>? onChanged;

  static const double height = 50;
  static const double _pad = KalloSpacing.sp1;

  /// The unchosen gold's veil. Dark rather than white: white lifts the gold
  /// towards the raised pill it is meant to sit behind. Twice
  /// [KalloColors.pressWashOnGold] — this recedes a surface for as long as it
  /// is unchosen, where that one marks a momentary press.
  static const Color _veil = Color(0x33141413); // ink @ 20%

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      padding: const EdgeInsets.all(_pad),
      decoration: BoxDecoration(
        color: kTrack,
        borderRadius: BorderRadius.circular(KalloRadii.pill),
      ),
      child: Row(
        children: [
          Expanded(
            child: _segment(
              label: monthlyLabel,
              selected: !yearly,
              onTap: onChanged == null ? null : () => _pick(false),
              child: _monthly(),
            ),
          ),
          Expanded(
            child: _segment(
              label: yearlyLabel,
              selected: yearly,
              onTap: onChanged == null ? null : () => _pick(true),
              child: _yearly(),
            ),
          ),
        ],
      ),
    );
  }

  void _pick(bool value) {
    if (value == yearly) return;
    HapticFeedback.selectionClick();
    onChanged!(value);
  }

  /// One half, announced as a selectable rather than as a button: a screen
  /// reader then says which of the two is on without either label growing a
  /// spoken suffix.
  Widget _segment({
    required String label,
    required bool selected,
    required VoidCallback? onTap,
    required Widget child,
  }) => Semantics(
    inMutuallyExclusiveGroup: true,
    selected: selected,
    label: label,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: child,
    ),
  );

  Widget _monthly() => DecoratedBox(
    decoration: BoxDecoration(
      color: yearly ? Colors.transparent : kCardSurface,
      borderRadius: BorderRadius.circular(KalloRadii.pill),
      boxShadow: yearly ? null : const [KalloShadows.sm],
    ),
    child: _label(monthlyLabel, !yearly),
  );

  Widget _yearly() => GoldPlanSurface(
    radius: KalloRadii.pill,
    glow: yearly,
    child: Stack(
      fit: StackFit.expand,
      children: [
        if (!yearly) const ColoredBox(color: _veil),
        _label(yearlyLabel, true),
      ],
    ),
  );

  /// [dashBody] and a [FittedBox], exactly as [SegmentedStrip] sets its own
  /// labels — the scale rather than a bespoke size, and the longest label
  /// shrinks at the top of the Dynamic Type range instead of clipping.
  /// Colour marks the selection; the semibold is this control's one addition,
  /// because a gold half needs more than a colour shift to read as chosen.
  Widget _label(String text, bool selected) => Center(
    child: FittedBox(
      fit: BoxFit.scaleDown,
      child: Text(
        text,
        maxLines: 1,
        softWrap: false,
        style: dashBody(
          color: selected ? kInk : kInkMuted,
          weight: selected ? FontWeight.w600 : FontWeight.w400,
        ),
      ),
    ),
  );
}
