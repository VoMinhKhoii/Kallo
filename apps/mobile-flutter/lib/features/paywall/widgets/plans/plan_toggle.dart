import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/kallo_typography.dart';
import 'gold_surface.dart';

/// Monthly ↔ yearly, as a segmented control on the app's track.
///
/// The yearly half is ALWAYS gold, selected or not — the gold marks the deal,
/// not the selection, which is why the same treatment reappears on the buy
/// button below. What marks the selection is elevation: the chosen half is
/// raised (a white pill, or the gold's own glow), and the unchosen gold takes
/// a 20% ink veil so the raised white beside it plainly wins. Two lit objects
/// with nothing separating them is what an untinted gold half produced.
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
  /// towards the raised pill it is meant to sit behind.
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
      boxShadow: yearly ? null : const [KalloShadows.xs],
    ),
    child: Center(child: Text(monthlyLabel, style: _label(!yearly))),
  );

  Widget _yearly() => GoldPlanSurface(
    radius: KalloRadii.pill,
    glow: yearly,
    child: Stack(
      fit: StackFit.expand,
      children: [
        if (!yearly) const ColoredBox(color: _veil),
        Center(child: Text(yearlyLabel, style: _label(true))),
      ],
    ),
  );

  /// 15, between Body (16) and Meta (14): the two labels share a 350pt row
  /// with the Vietnamese "Gói tháng"/"Gói năm" pair, and Body overflows it.
  /// The chosen half is semibold ink; the unchosen monthly recedes to muted.
  TextStyle _label(bool selected) => TextStyle(
    fontFamily: KalloTextStyles.sansFamily,
    fontSize: 15,
    fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
    letterSpacing: -0.1,
    color: selected ? kInk : kInkMuted,
  );
}
