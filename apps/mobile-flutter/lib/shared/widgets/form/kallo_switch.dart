import 'package:flutter/cupertino.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// The app's one switch — umber when on, iOS geometry and feel throughout.
///
/// [CupertinoSwitch] directly, not `Switch.adaptive`. The adaptive switch got
/// the right shape on iOS but needed a workaround to get the right colour:
/// `ThemeData.switchTheme` never reaches it, because Flutter's
/// `_SwitchThemeAdaptation.adapt()` returns a bare `const SwitchThemeData()`
/// on iOS and macOS (`material/switch.dart`), so a theme would quietly fix
/// Android and leave iOS on the Cupertino default green. That forced a
/// widget-level `trackColor` resolver whose only job was to be the one entry
/// in the fallback chain that lands. [CupertinoSwitch.activeTrackColor] is
/// simply the colour, and the resolver is gone.
///
/// The thumb's press behaviour comes with it rather than being rebuilt: the
/// thumb stretches while a finger is down (`_kThumbExtensionFactor = 7.0` in
/// `cupertino/switch.dart`) and settles on release. That is the expand the
/// hand-rolled controls in this app imitate by hand, here for free and at the
/// platform's own timing.
///
/// Umber ([KalloColors.btn]) is web parity: the shadcn switch there is
/// `data-[state=checked]:bg-primary`, and `--primary` is `--kallo-btn`.
class KalloSwitch extends StatelessWidget {
  const KalloSwitch({
    super.key,
    required this.value,
    required this.onChanged,
    this.semanticLabel,
  });

  final bool value;

  /// Null disables the switch (an update in flight, a gated preference).
  final ValueChanged<bool>? onChanged;

  /// Names the control for screen readers when the surrounding row provides no
  /// toggle semantics of its own — without it a bare on/off state is announced.
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    // Only the ON track is themed. Leaving `inactiveTrackColor` alone keeps the
    // platform's own off state, which is what the `trackColor` resolver was
    // doing by resolving to null while unselected.
    // `CupertinoSwitch` renders at 59x39 (`_kSwitchSize`, cupertino/switch.dart)
    // — 5pt under the app's 44pt floor. `Switch.adaptive` used to hide that:
    // Material wraps its switch in a `padded` tap target of at least 48. Taking
    // the Cupertino widget directly gives up that padding, so the floor is
    // restored here rather than silently lost. The constraint is on the TARGET,
    // not the control, so the switch itself is unchanged.
    final switchWidget = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: KalloIcons.hit),
      child: Center(
        widthFactor: 1,
        heightFactor: 1,
        child: CupertinoSwitch(
          value: value,
          onChanged: onChanged,
          activeTrackColor: KalloColors.btn,
        ),
      ),
    );

    if (semanticLabel == null) return switchWidget;
    return Semantics(label: semanticLabel, child: switchWidget);
  }
}
