import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../../models/nutrition/ingredient.dart';
import '../../../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../../../shared/widgets/sheet/sheet_capsule_button.dart';
import 'manual_search_field.dart';
import 'manual_search_results.dart';

/// The add sheet's first level: "Add ingredients", the search pill, and the
/// results. "Done" joins the header once something has been added — before
/// that the close X is the only way out, and the two would mean the same.
class ManualSearchPage extends StatelessWidget {
  const ManualSearchPage({
    super.key,
    required this.controller,
    required this.autofocus,
    required this.query,
    required this.resultsAsync,
    required this.itemFor,
    required this.onPick,
    required this.showDone,
  });

  final TextEditingController controller;
  final bool autofocus;
  final String query;
  final AsyncValue<List<IngredientSearchResult>> resultsAsync;
  final ManualLogItem? Function(String ingredientId) itemFor;
  final ValueChanged<IngredientSearchResult> onPick;
  final bool showDone;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KalloSheetHeader(
          title: 'logging.manualLogging.sheetTitle'.tr(),
          trailing:
              showDone
                  ? SheetCapsuleButton(
                    label: 'logging.manualLogging.done'.tr(),
                    onTap: () => Navigator.of(context).pop(),
                  )
                  : null,
        ),
        ManualSearchField(controller: controller, autofocus: autofocus),
        Expanded(
          child: ManualSearchResults(
            query: query,
            resultsAsync: resultsAsync,
            itemFor: itemFor,
            onPick: onPick,
          ),
        ),
      ],
    );
  }
}
