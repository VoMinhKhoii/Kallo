import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../shared/widgets/sheet/sheet_capsule_button.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/meal_edit/meal_edit_draft.dart';
import '../../logic/meal_edit/meal_edit_format.dart';
import 'meal_edit_dish_section.dart';
import 'meal_edit_stepper_row.dart';
import 'meal_edit_summary.dart';

/// Opens the edit sheet on [draft]. [onCommit] runs on Save (Done for an
/// unsaved meal); the sheet closes when it resolves and stays open, ready to
/// retry, when it throws — the caller raises the error toast.
Future<void> showMealEditSheet(
  BuildContext context, {
  required MealEditDraft draft,
  required String commitLabel,
  required Future<void> Function(MealEditDraft draft) onCommit,
  String? sizeOpen,
}) => showNhamSheet<void>(
  context,
  builder:
      (_) => MealEditSheet(
        draft: draft,
        commitLabel: commitLabel,
        onCommit: onCommit,
        sizeOpen: sizeOpen,
      ),
);

/// The whole meal on top — its calories, bar and legend, and a Whole meal
/// stepper — then every dish with its own Servings, Amount and Size.
class MealEditSheet extends StatefulWidget {
  const MealEditSheet({
    super.key,
    required this.draft,
    required this.commitLabel,
    required this.onCommit,
    this.sizeOpen,
  });

  /// A dish whose Size dropdown starts open — the card's portion line opens
  /// the sheet straight onto the size it names.
  final String? sizeOpen;

  final MealEditDraft draft;
  final String commitLabel;
  final Future<void> Function(MealEditDraft draft) onCommit;

  @override
  State<MealEditSheet> createState() => _MealEditSheetState();
}

class _MealEditSheetState extends State<MealEditSheet> {
  late MealEditDraft _draft = widget.draft;

  /// The dish whose Size dropdown is open — one at a time.
  late String? _sizeOpen = widget.sizeOpen;
  bool _saving = false;

  Future<void> _commit() async {
    setState(() => _saving = true);
    try {
      await widget.onCommit(_draft);
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _set(MealEditDraft next) => setState(() {
    _draft = next;
    if (_sizeOpen != null && next.dish(_sizeOpen!) == null) _sizeOpen = null;
  });

  @override
  Widget build(BuildContext context) {
    final locale = localeOf(context);
    final d = _draft;
    return KalloSheetSurface(
      // The dishes sit in white grouped cards, so the sheet paints the canvas
      // and the cards separate by surface, as they do on a page.
      color: kPage,
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.92,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          KalloSheetHeader(
            title: 'logging.mealEdit.title'.tr(),
            closeEnabled: !_saving,
            trailing: SheetCapsuleButton(
              label: widget.commitLabel,
              onTap: _saving ? null : _commit,
            ),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                KalloSpacing.sp4,
                KalloSpacing.sp2,
                KalloSpacing.sp4,
                MediaQuery.paddingOf(context).bottom + KalloSpacing.sp6,
              ),
              child: AbsorbPointer(
                absorbing: _saving,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    MealEditSummary(totals: d.totals),
                    const SizedBox(height: KalloSpacing.sp5),
                    GroupedListCard(
                      separatorInset: 0,
                      children: [
                        MealEditStepperRow(
                          label: 'logging.mealEdit.wholeMeal'.tr(),
                          value: formatTimes(d.whole, locale),
                          minusLabel: 'logging.mealEdit.lessWhole'.tr(),
                          plusLabel: 'logging.mealEdit.moreWhole'.tr(),
                          onMinus:
                              d.whole <= servingStep
                                  ? null
                                  : () => _set(d.stepWhole(-1)),
                          onPlus: () => _set(d.stepWhole(1)),
                        ),
                      ],
                    ),
                    for (final dish in d.dishes)
                      MealEditDishSection(
                        key: ValueKey(dish.key),
                        draft: d,
                        dish: dish,
                        sizeOpen: _sizeOpen == dish.key,
                        onDraft: _set,
                        onToggleSize:
                            () => setState(
                              () =>
                                  _sizeOpen =
                                      _sizeOpen == dish.key ? null : dish.key,
                            ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
