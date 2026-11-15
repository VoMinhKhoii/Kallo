import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import '../../../../theme/calm_tokens.dart';
import 'auth_brand_hero.dart';

/// The welcome identity can stand beside a task without repeating its controls.
class WelcomeBrand extends StatelessWidget {
  const WelcomeBrand({super.key});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(24),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const AuthBrandHero(),
        const SizedBox(height: 8),
        Text(
          tr('auth.welcome.tagline'),
          textAlign: TextAlign.center,
          style: dashBody(color: kInkMuted),
        ),
      ],
    ),
  );
}
