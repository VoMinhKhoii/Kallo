import 'dart:math';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import 'entrances.dart';

// The "what did you eat?" prompt has several phrasings; one is chosen at random
// per visit so the empty feed feels alive instead of canned.
const _titleKeys = [
  'logging.emptyState.title',
  'logging.emptyState.title2',
  'logging.emptyState.title3',
  'logging.emptyState.title4',
  'logging.emptyState.title5',
];

/// The empty feed: an icon tile and a single rotating "What did you eat?"
/// prompt. Staggered icon→title entrance (mirrors the web: icon scale delay 50,
/// title 100).
class EmptyState extends StatefulWidget {
  const EmptyState({super.key});

  @override
  State<EmptyState> createState() => _EmptyStateState();
}

class _EmptyStateState extends State<EmptyState> {
  late final String _titleKey = _titleKeys[Random().nextInt(_titleKeys.length)];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp10), // py-10
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Icon tile — w-10 h-10 rounded-xl bg-border/30, UtensilsCrossed 20px.
          ZoomIn(
            delay: const Duration(milliseconds: 50),
            child: Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: NhamColors.borderFaint, // border @ 30%
                borderRadius: BorderRadius.circular(NhamRadii.xl), // rounded-xl
              ),
              child: const Icon(
                LucideIcons.utensilsCrossed,
                size: 20,
                color: NhamColors.textMuted,
              ),
            ),
          ),
          const SizedBox(height: NhamSpacing.sp4), // gap-4
          FadeInDown(
            delay: const Duration(milliseconds: 100),
            child: Text(
              _titleKey.tr(),
              textAlign: TextAlign.center,
              style: dashBody().merge(const TextStyle(letterSpacing: NhamTracking.tight)),
            ),
          ),
        ],
      ),
    );
  }
}
