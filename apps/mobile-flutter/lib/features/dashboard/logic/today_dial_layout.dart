import 'package:flutter/widgets.dart';

import '../../../shared/widgets/gauge/calorie_dial.dart';
import '../../../shared/widgets/gauge/macros/macro_dial_row.dart';
import '../../../shell/window/window_layout.dart';

/// Whether Today draws its four dials in one row in a section [width] wide.
///
/// A window under [kRegularHeight] (a phone on its side, iPhone Duo's closed
/// display turned sideways) has too little height under the header and the
/// week strip to stack the calorie dial over the macros. One row is only as
/// tall as the calorie dial, but it needs the width for all four at full
/// size; a narrower short window keeps the stack and scrolls.
///
/// The dials and their loading skeleton both ask this, so the skeleton never
/// takes the other arrangement and jumps when the day arrives.
bool todayDialsInOneRow(BuildContext context, double width) =>
    WindowLayout.of(context).compactHeight &&
    width >= leadRowWidth(kCalorieDialRadius * 2, kMacroDialRadius);
