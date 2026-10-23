import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/logging_ui_state.dart';
import '../../data/logging_models.dart';
import '../../../../theme/kallo_motion.dart';
import '../../logic/logging_spacing.dart';
import '../../logic/meal_edit/meal_edit_sources.dart';
import '../actions/confirm_meal_removal.dart';
import '../actions/meal_hold_menu.dart';
import '../actions/swipe_to_remove.dart';
import '../meal_edit/meal_edit_sheet.dart';
import '../turn/turn_header.dart';
import 'persisted_meal_actions.dart';
import 'persisted_meal_card_content.dart';

/// A saved meal in the day's feed — collapsed by default, expandable.
///
/// Ported from web
/// `components/logging/feed/persisted/persisted-meal-card.tsx`: the chevron
/// rotates 0°↔180°, the detail block animates its height open/closed, and the
/// bar + legend it pushes down travel with it.
///
/// The web's flat 200ms ease-in-out is NOT kept. It opened like a drawer being
/// pulled rather than a row answering a tap, and the chevron ran off the raw
/// controller while the height ran through the curve, so the two disagreed on
/// screen. One eased animation now drives every moving part — see
/// [_PersistedMealCardState._curvedExpand].
class PersistedMealCard extends ConsumerStatefulWidget {
  const PersistedMealCard({
    super.key,
    required this.meal,
    this.onRemove,
    this.onUpdate,
    this.onLogAgain,
  });

  final PersistedMeal meal;

  /// iOS trailing-swipe removal (destructive red) — fired when the card is
  /// dismissed. Null disables the swipe.
  final VoidCallback? onRemove;

  /// Persist an edit from the sheet (gram overrides + per-row removals). Null
  /// drops Edit from the hold menu.
  final AmountEditSave? onUpdate;

  /// Re-log this meal onto the current day (deterministic server-side copy).
  /// Null hides the "Log again" action.
  final Future<void> Function()? onLogAgain;

  @override
  ConsumerState<PersistedMealCard> createState() => _PersistedMealCardState();
}

class _PersistedMealCardState extends ConsumerState<PersistedMealCard>
    with SingleTickerProviderStateMixin {
  // Seeded from the app-lifetime expansion set, not `true`: the Log route is
  // a fresh push per visit, so a card that only remembered itself in State
  // snapped shut every time the user left the screen (TestFlight regression,
  // 2026-08-31). A restored-open card starts at progress 1 — no replay of the
  // open animation on re-entry.
  late bool _collapsed =
      !ref.read(expandedMealCardsProvider).contains(widget.meal.id);

  // expandProgress 0 (collapsed) → 1 (expanded). Opens on [disclosure] (180),
  // closes on [press] (150) — see the token docs for why the two differ.
  late final AnimationController _expand = AnimationController(
    vsync: this,
    value: _collapsed ? 0 : 1,
    duration: KalloMotion.disclosure,
    reverseDuration: KalloMotion.press,
  );

  /// The ONE curve every moving part of the disclosure rides: the details'
  /// height and fade, the bar + legend they push down, and the chevron above
  /// them. Built once, not per build — a CurvedAnimation with a reverseCurve
  /// registers a status listener on its parent, so rebuilding it would orphan
  /// one per frame.
  ///
  /// The chevron used to be driven by the raw [_expand] controller while the
  /// height ran through this curve, so the two visibly disagreed: the linear
  /// chevron was already half-turned while the eased height had barely begun.
  late final CurvedAnimation _curvedExpand = CurvedAnimation(
    parent: _expand,
    curve: KalloEase.enter,
    reverseCurve: KalloEase.exit,
  );

  void _toggle() {
    setState(() => _collapsed = !_collapsed);
    final expanded = {...ref.read(expandedMealCardsProvider)};
    if (_collapsed) {
      expanded.remove(widget.meal.id);
      _expand.reverse();
    } else {
      expanded.add(widget.meal.id);
      _expand.forward();
    }
    ref.read(expandedMealCardsProvider.notifier).state = expanded;
  }

  /// Opens the edit sheet. Its Save sends only what changed; an untouched sheet
  /// closes without a request.
  void _openEditor() {
    final meal = widget.meal;
    final save = widget.onUpdate!;
    showMealEditSheet(
      context,
      draft: draftFromPersisted(meal),
      commitLabel: 'logging.mealEdit.save'.tr(),
      onCommit: (draft) async {
        final out = persistedEditFrom(meal, draft);
        if (out.edits.isEmpty && out.removeIds.isEmpty) return;
        await save(edits: out.edits, removeIds: out.removeIds);
      },
    );
  }

  Future<void> _confirmRemove() async {
    if (await confirmMealRemoval(context) && mounted) widget.onRemove?.call();
  }

  @override
  void dispose() {
    _curvedExpand.dispose();
    _expand.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final meal = widget.meal;
    final time = DateFormat.jm(
      context.locale.toString(),
    ).format(DateTime.parse(meal.loggedAt).toLocal());

    // Only meals with a gram-bearing ingredient row can be edited; a
    // legacy/empty meal has nothing to scale. Mirrors the web card's `canEdit`.
    final canEdit =
        widget.onUpdate != null &&
        meal.mealItemGroups.any(
          (g) => g.ingredients.any((i) => i.estimatedGrams != null),
        );

    // No bottom margin: the feed's list separator owns the gap to the next
    // card, so a card never adds spacing of its own.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Time as a centered divider on top of the card (── 1:04 AM ──) —
        // no left timeline gutter, so the card gets the full row width.
        TurnHeader(time: time, message: meal.rawInput),
        SwipeToRemove(
          mealId: meal.id,
          onRemove: widget.onRemove,
          builder:
              (context, radius) => MealHoldMenu(
                removeLabel: 'logging.remove'.tr(),
                onEdit: canEdit ? _openEditor : null,
                onRemove: widget.onRemove == null ? null : _confirmRemove,
                child: PersistedMealCardContent(
                  meal: meal,
                  curvedExpand: _curvedExpand,
                  onToggle: _toggle,
                  borderRadius: radius,
                ),
              ),
        ),
        const SizedBox(height: LoggingSpacing.actions),
        PersistedMealActions(meal: meal, onLogAgain: widget.onLogAgain),
      ],
    );
  }
}
