import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';

/// The app's one switch — umber when on, native geometry throughout.
///
/// [Switch.adaptive] is kept so the control keeps each platform's own size,
/// animation and drag behaviour. The colour, however, CANNOT come from
/// `ThemeData.switchTheme`: on iOS and macOS Flutter's `_SwitchThemeAdaptation`
/// discards the ambient theme outright (`material/switch.dart` — its `adapt()`
/// returns `const SwitchThemeData()` for those platforms), so a `switchTheme`
/// would quietly fix Android and leave iOS on the Cupertino default green.
///
/// The widget-level [Switch.trackColor] is the first entry in the resolver's
/// fallback chain on every platform, so it is the one override that actually
/// lands. Resolving to `null` while unselected falls through to the platform
/// default track, which means only the checked state is themed.
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
    final switchWidget = Switch.adaptive(
      value: value,
      onChanged: onChanged,
      trackColor: WidgetStateProperty.resolveWith<Color?>(
        (states) =>
            states.contains(WidgetState.selected) ? KalloColors.btn : null,
      ),
    );

    if (semanticLabel == null) return switchWidget;
    return Semantics(label: semanticLabel, child: switchWidget);
  }
}
