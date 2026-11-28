import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../shell/window/keep_clear.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';

/// The head of the code face: its title, then "we sent a code to" over the
/// address it went to.
///
/// With the keyboard up these lines sit beside the status items of a control
/// column, so each wraps before it.
class EmailCodeHeading extends StatelessWidget {
  const EmailCodeHeading({super.key, required this.email});

  final String email;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      KeepClear(child: Text(tr('auth.code.title'), style: kPageTitle())),
      const SizedBox(height: KalloSpacing.sp2),
      KeepClear(
        child: Text(tr('auth.code.sentTo'), style: dashBody(color: kInkMuted)),
      ),
      const SizedBox(height: KalloSpacing.sp0_5),
      KeepClear(child: Text(email, style: dashBody(weight: FontWeight.w500))),
    ],
  );
}
