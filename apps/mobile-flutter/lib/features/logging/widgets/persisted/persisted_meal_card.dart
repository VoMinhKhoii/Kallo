import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../data/logging_models.dart';
import '../../logic/logging_spacing.dart';
import '../confirm_meal_removal.dart';
import 'persisted_meal_actions.dart';
import 'persisted_meal_amount_editor.dart';
import 'persisted_meal_card_content.dart';
import 'persisted_meal_time_divider.dart';

/// A saved meal in the day's feed — collapsed by default, expandable.
///
/// Ported 1:1 from
/// `apps/mobile/src/components/logging/feed/persisted-meal-card.tsx`: the
/// chevron rotates 0°↔180° (200ms), the collapsed summary cross-fades out, and
/// the detail block animates its height open/closed (200ms).
class PersistedMealCard extends StatefulWidget {
  const PersistedMealCard({
    super.key,
    required this.meal,
    this.isLast = false,
    this.onRemove,
    this.onUpdate,
    this.onLogAgain,
  });

  final PersistedMeal meal;
  final bool isLast;

  /// iOS trailing-swipe removal (terracotta, never red) — fired when the card is
  /// dismissed. Null disables the swipe.
  final VoidCallback? onRemove;

  /// Persist an amount edit (gram overrides + per-row removals). Null disables
  /// the "Edit amounts" affordance entirely.
  final AmountEditSave? onUpdate;

  /// Re-log this meal onto the current day (deterministic server-side copy).
  /// Null hides the "Log again" action.
  final Future<void> Function()? onLogAgain;

  @override
  State<PersistedMealCard> createState() => _PersistedMealCardState();
}

class _PersistedMealCardState extends State<PersistedMealCard>
    with SingleTickerProviderStateMixin {
  bool _collapsed = true;
  bool _editing = false;

  // expandProgress 0 (collapsed) → 1 (expanded), 200ms.
  late final AnimationController _expand = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 200),
  );

  void _toggle() {
    setState(() => _collapsed = !_collapsed);
    if (_collapsed) {
      _expand.reverse();
    } else {
      _expand.forward();
    }
  }

  @override
  void dispose() {
    _expand.dispose();
    super.dispose();
  }

  /// Wrap the card in a trailing-swipe-to-remove Dismissible (terracotta, never
  /// red) when [onRemove] is set; otherwise return the card untouched.
  Widget _maybeDismissible(Widget card) {
    final onRemove = widget.onRemove;
    if (onRemove == null) return card;
    return Dismissible(
      key: ValueKey('dismiss-${widget.meal.id}'),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) => confirmMealRemoval(context),
      onDismissed: (_) => onRemove(),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp5),
        decoration: BoxDecoration(
          color: NhamColors.danger,
          borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              LucideIcons.trash2,
              size: LoggingIcons.size,
              color: Colors.white,
            ),
            const SizedBox(width: 6),
            Text(
              'logging.remove'.tr(),
              style: dashBody(color: Colors.white, weight: FontWeight.w500),
            ),
          ],
        ),
      ),
      child: card,
    );
  }

  @override
  Widget build(BuildContext context) {
    final meal = widget.meal;
    final time = DateFormat.jm(
      context.locale.toString(),
    ).format(DateTime.parse(meal.loggedAt).toLocal());

    // Details height open/close: 200ms ease-in-out (persisted-meal-card.tsx:231).
    final curvedExpand = CurvedAnimation(
      parent: _expand,
      curve: Curves.easeInOut,
    );

    // Only meals with a gram-bearing ingredient row can be amount-edited; a
    // legacy/empty meal has nothing to step. Mirrors the web card's `canEdit`.
    final canEdit =
        widget.onUpdate != null &&
        meal.mealItemGroups.any(
          (g) => g.ingredients.any((i) => i.estimatedGrams != null),
        );

    final Widget? editorBody =
        _editing && widget.onUpdate != null
            ? PersistedMealAmountEditor(
              meal: meal,
              onCancel: () => setState(() => _editing = false),
              onSave: widget.onUpdate!,
            )
            : null;

    final cardBody = PersistedMealCardContent(
      meal: meal,
      expand: _expand,
      curvedExpand: curvedExpand,
      onToggle: _toggle,
      editorBody: editorBody,
    );

    // No bottom margin: the feed's list separator owns the gap to the next
    // card, so a card never adds spacing of its own.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Time as a centered divider on top of the card (── 1:04 AM ──) —
        // no left timeline gutter, so the card gets the full row width.
        PersistedMealTimeDivider(time: time),
        const SizedBox(height: LoggingSpacing.block),
        // Editing swaps the body in place AND hides the action row (the web
        // hides the action bar while editing). While editing the card is not
        // swipe-dismissible — a stray swipe must not delete the meal mid-edit.
        _editing ? cardBody : _maybeDismissible(cardBody),
        if (!_editing) ...[
          const SizedBox(height: LoggingSpacing.actions),
          PersistedMealActions(
            meal: meal,
            onRemove: widget.onRemove,
            onEditAmounts:
                canEdit ? () => setState(() => _editing = true) : null,
            onLogAgain: widget.onLogAgain,
          ),
        ],
      ],
    );
  }
}
