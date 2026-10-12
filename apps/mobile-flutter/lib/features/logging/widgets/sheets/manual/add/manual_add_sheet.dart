import 'dart:async';
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
import 'manual_peek_strip.dart';
import 'manual_search_page.dart';

/// Stack the add sheet over the meal sheet. With [editing] it opens straight
/// onto that item's food page, and leaving the page closes the sheet.
Future<void> showManualAddSheet(
  BuildContext context, {
  ManualLogItem? editing,
}) => showNhamSheet<void>(
  context,
  builder: (_) => ManualAddSheet(editing: editing),
);

typedef _OpenFood = ({IngredientSearchResult food, String? itemId});

/// The second sheet: search, then a food's page, then back to search with the
/// food marked as added — one surface whose content pages ([SheetPageSwap]),
/// over a strip of the meal sheet that keeps the running total in view.
///
/// The query, the grams and the page live HERE, above the swap: the swap
/// rebuilds both pages from scratch, so anything kept inside one would reset.
class ManualAddSheet extends ConsumerStatefulWidget {
  const ManualAddSheet({super.key, this.editing});

  final ManualLogItem? editing;

  @override
  ConsumerState<ManualAddSheet> createState() => _ManualAddSheetState();
}

class _ManualAddSheetState extends ConsumerState<ManualAddSheet> {
  final TextEditingController _search = TextEditingController();
  Timer? _debounce;
  String _query = '';
  late _OpenFood? _open = _editingFood();
  late double _grams = widget.editing?.grams ?? 100;
  bool _addedAny = false;
  bool _visitedFood = false;

  /// The last results that arrived, kept on screen while the next query loads
  /// so typing a letter doesn't blank the list.
  ({String query, List<IngredientSearchResult> results})? _shown;

  _OpenFood? _editingFood() {
    final item = widget.editing;
    return item == null ? null : (food: item.ingredient, itemId: item.id);
  }

  @override
  void initState() {
    super.initState();
    _search.addListener(() {
      _debounce?.cancel();
      _debounce = Timer(const Duration(milliseconds: 300), () {
        if (mounted) setState(() => _query = _search.text.trim());
      });
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _pick(IngredientSearchResult food) {
    FocusScope.of(context).unfocus();
    final item = ref.read(manualLogProvider).itemFor(food.id);
    setState(() {
      _open = (food: food, itemId: item?.id);
      _grams = item?.grams ?? initialManualGrams(food);
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

  void _commit() {
    final open = _open!;
    final notifier = ref.read(manualLogProvider.notifier);
    if (open.itemId != null) {
      notifier.updateGrams(open.itemId!, _grams);
    } else {
      notifier.addIngredient(open.food, grams: _grams);
      _addedAny = true;
    }
    _leaveFood();
  }

  void _remove() {
    ref.read(manualLogProvider.notifier).removeItem(_open!.itemId!);
    _leaveFood();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(manualLogProvider);
    final async = ref.watch(ingredientSearchProvider(_query));
    if (async.valueOrNull case final results?) {
      _shown = (query: _query, results: results);
    }
    final held = async.isLoading ? _shown : null;
    final media = MediaQuery.of(context);
    final strip = ManualPeekStrip.visibleHeight(context);
    final height =
        media.size.height -
        media.viewPadding.top -
        KalloSpacing.sp2 -
        strip -
        media.viewInsets.bottom;
    final open = _open;
    // A new food on a full plate cannot go in: the strip promises nothing.
    final blocked = state.isFull && open?.itemId == null;
    final peek = ManualPeekStrip.texts(
      state.items,
      food: blocked ? null : open?.food,
      grams: _grams,
      itemId: open?.itemId,
    );

    return Stack(
      children: [
        Positioned(
          top: 0,
          left: 14,
          right: 14,
          height: strip + kSheetRadius,
          child: ManualPeekStrip(text: peek.$1, after: peek.$2),
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
                        controller: _search,
                        autofocus: !_visitedFood,
                        query: held?.query ?? _query,
                        resultsAsync:
                            held == null ? async : AsyncData(held.results),
                        itemFor: state.itemFor,
                        onPick: _pick,
                        showDone: _addedAny,
                      )
                      : ManualFoodPage(
                        key: ValueKey('manual-food-${open.food.id}'),
                        food: open.food,
                        grams: _grams,
                        inMeal: open.itemId != null,
                        onGrams: (grams) => setState(() => _grams = grams),
                        onCommit: _commit,
                        onRemove: open.itemId == null ? null : _remove,
                        mealFull: state.isFull,
                        onBack: widget.editing == null ? _leaveFood : null,
                      ),
            ),
          ),
        ),
      ],
    );
  }
}
