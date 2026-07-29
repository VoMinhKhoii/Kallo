import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../shared/widgets/widgets.dart';
import '../theme/calm_tokens.dart';
import '../theme/nham_theme.dart';
import 'app_header.dart';

/// Stand-in surface for nav destinations whose feature screens don't exist in
/// the Flutter app yet (Groups, Admin). It keeps the drawer nav model honest —
/// every drawer item navigates somewhere with the shared header + hamburger —
/// without inventing a feature UI. Replace with the real screen under
/// `lib/features/<feature>/` when that surface is ported.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({required this.titleKey, super.key});

  final String titleKey;

  @override
  Widget build(BuildContext context) {
    return Screen(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp3),
            // Back affordance: a deep link can land here directly, so the
            // header must always offer a way out (pop if possible, else home).
            child: AppHeader(
              onBack: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go('/logging');
                }
              },
            ),
          ),
          Expanded(
            child: Center(
              child: Text(tr(titleKey), style: dashHeadline()),
            ),
          ),
        ],
      ),
    );
  }
}
