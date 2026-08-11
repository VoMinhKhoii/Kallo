import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/nham_empty_state.dart';
import '../../../shared/widgets/seed_mark.dart';
import 'fade_in_down.dart';

/// The nutrition page with nothing logged in range: the shared empty-state
/// template, a sprouting-seed mark, and the one way forward.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    // Web motion.section opacity/y:8 duration 0.55 delay 0.1.
    return FadeInDown(
      duration: const Duration(milliseconds: 550),
      delay: const Duration(milliseconds: 100),
      child: NhamEmptyState(
        mark: const SeedMark(),
        title: tr('nutrition.emptyV2.title'),
        description: tr('nutrition.emptyV2.description'),
        action: NhamEmptyStateAction(
          label: tr('nutrition.emptyV2.logMeal'),
          onTap: () => context.go('/logging'),
        ),
      ),
    );
  }
}
