import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../../models/nutrition/ingredient.dart';
import '../../../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../../../shared/widgets/sheet/sheet_page_swap.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_theme.dart';
import '../../../../data/manual_log_providers.dart';
import '../../../../logic/manual/manual_amount.dart';
import '../food/manual_food_page.dart';
import '../../../../logic/manual/manual_display.dart';
import 'manual_open_food.dart';
import 'manual_peek_strip.dart';
import 'manual_search_page.dart';
import 'manual_search_session.dart';

/// Stack the add sheet over the meal sheet. With [editing] it opens straight
/// onto that item's food page, and leaving the page closes the sheet.
Future<void> showManualAddSheet(
  BuildContext context, {
  ManualLogItem? editing,
}) => showNhamSheet<void>(
  context,
  builder: (_) => ManualAddSheet(editing: editing),
);

/// The second sheet: search, then a food's page, then back to search with the
/// food marked as added — one surface whose content pages ([SheetPageSwap]),
/// over a strip of the meal sheet that keeps the running total in view.
///
/// The query and the open food (with its grams) live HERE, above the swap: the
/// swap rebuilds both pages from scratch, so anything kept inside one would
/// reset.
class ManualAddSheet extends ConsumerStatefulWidget {
  const ManualAddSheet({super.key, this.editing});

  final ManualLogItem? editing;

  @override
  ConsumerState<ManualAddSheet> createState() => _ManualAddSheetState();
}

class _ManualAddSheetState extends ConsumerState<ManualAddSheet> {
  final ManualSearchSession _search = ManualSearchSession();
  late ManualOpenFood? _open = switch (widget.editing) {
    final item? => MealFood(item),
    null => null,
  };
  bool _addedAny = false;
  bool _visitedFood = false;

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _pick(IngredientSearchResult food) {
    FocusScope.of(context).unfocus();
    final item = ref.read(manualLogProvider).itemFor(food.id);
    setState(() {
      _open =
          item == null
              ? NewFood(food, initialManualGrams(food))
              : MealFood(item);
      _visitedFood = true;
    });
  }

  /// Leave the food page: back to the results, or — opened from a meal row —
  /// back to the meal.
  void _leaveFood() {
    if (widget.editing != null) {
      Navigator.of(context).pop();
    } else {
      setState(() => _open = null);
    }
  }

  void _commit(ManualOpenFood open) {
    final notifier = ref.read(manualLogProvider.notifier);
    switch (open) {
      case NewFood(:final food, :final grams):
        notifier.addIngredient(food, grams: grams);
        _addedAny = true;
      case MealFood(:final item, :final grams):
        notifier.updateGrams(item.id, grams);
    }
    _leaveFood();
  }

  void _remove(ManualLogItem item) {
    ref.read(manualLogProvider.notifier).removeItem(item.id);
    _leaveFood();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(manualLogProvider);
    final shown = _search.shown(
      ref.watch(ingredientSearchProvider(_search.query)),
    );
    final media = MediaQuery.of(context);
    final strip = ManualPeekStrip.visibleHeight(context);
    final height =
        media.size.height -
        media.viewPadding.top -
        KalloSpacing.sp2 -
        strip -
        media.viewInsets.bottom;
    final open = _open;
    // A new food on a full plate cannot go in: its page says so, and the strip
    // promises nothing for it.
    final blocked = open is NewFood && state.isFull;
    final peek = manualPeek(
      state.items,
      open == null || blocked
          ? null
          : (food: open.food, grams: open.grams, itemId: open.itemId),
    );

    return Stack(
      children: [
        Positioned(
          top: 0,
          left: 14,
          right: 14,
          height: strip + kSheetRadius,
          child: ManualPeekStrip(peek: peek),
        ),
        Padding(
          padding: EdgeInsets.only(top: strip),
          child: KalloSheetSurface(
            color: kPage,
            constraints: BoxConstraints.tightFor(height: math.max(0, height)),
            padding: const EdgeInsets.symmetric(horizontal: kSheetContentInset),
            child: SheetPageSwap(
              isSecondLevel: open != null,
              child:
                  open == null
                      ? ManualSearchPage(
                        key: const ValueKey('manual-search'),
                        controller: _search.field,
                        autofocus: !_visitedFood,
                        query: shown.query,
                        resultsAsync: shown.results,
                        itemFor: state.itemFor,
                        onPick: _pick,
                        showDone: _addedAny,
                      )
                      : ManualFoodPage(
                        key: ValueKey('manual-food-${open.food.id}'),
                        food: open.food,
                        grams: open.grams,
                        inMeal: open is MealFood,
                        blocked: blocked,
                        onGrams:
                            (grams) =>
                                setState(() => _open = open.withGrams(grams)),
                        onCommit: () => _commit(open),
                        onRemove: switch (open) {
                          MealFood(:final item) => () => _remove(item),
                          NewFood() => null,
                        },
                        onBack: widget.editing == null ? _leaveFood : null,
                      ),
            ),
          ),
        ),
      ],
    );
  }
}
