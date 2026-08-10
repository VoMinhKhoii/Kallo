import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

class MealEntryEditPill extends StatelessWidget {
  const MealEntryEditPill({
    super.key,
    required this.editing,
    required this.onTap,
  });

  final bool editing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // AnimatePresence mode=wait: the whole pill (border/bg + content) is the
    // swapped node, scaling+fading 0.85→1 over 150ms (meal-entry.tsx:126-166).
    return GestureDetector(
      onTap: onTap,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 150),
        transitionBuilder: (child, animation) {
          return FadeTransition(
            opacity: animation,
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.85, end: 1).animate(animation),
              child: child,
            ),
          );
        },
        child: Container(
          key: ValueKey(editing ? 'done' : 'edit'),
          padding: const EdgeInsets.symmetric(
            vertical: 4,
            horizontal: 10,
          ), // py-1 px-2.5
          decoration: BoxDecoration(
            color: editing ? NhamColors.accent10 : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.pill),
            border: Border.all(
              color: editing ? NhamColors.accent50 : NhamColors.borderSoft,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                editing
                    ? LucideIcons.check300
                    : LucideIcons.pencil300, // Check / Pencil
                size: 12,
                color: editing ? NhamColors.text : NhamColors.textMuted,
              ),
              const SizedBox(width: 6), // gap-1.5
              Text(
                editing
                    ? 'logging.mealEntry.done'.tr()
                    : 'logging.mealEntry.edit'.tr(),
                style: dashMeta().merge(
                  TextStyle(color: editing ? NhamColors.text : kInkMuted),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Confirm CTA below the card. Editing → ghost (btn/40 border); else → solid btn.
/// Pressed mirrors the web hover: solid → btn-hover bg + shadow-md; ghost →
/// btn border + btn/5 bg. transition-all duration-200.
