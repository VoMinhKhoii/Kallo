import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../../shared/widgets/surface/kallo_button.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../data/manual_log_providers.dart';
import '../../../logic/manual/manual_display.dart';
import 'add/manual_add_sheet.dart';
import 'meal/manual_meal_items.dart';
import 'meal/manual_meal_totals.dart';
import 'meal/manual_name_field.dart';

/// Open the manual-log sheet: build a meal from the food database, weighing
/// each food as it goes in — deterministic, no AI.
Future<void> showManualLogSheet(
  BuildContext context, {
  required String userId,
  required String date,
}) {
  return showNhamSheet<void>(
    context,
    builder: (context) => ManualLogSheet(userId: userId, date: date),
  );
}

/// Plate first (approved canvas, E1): the meal's name, its macro ring, the
/// ingredients already on it, and "Add ingredient", which stacks the search
/// sheet over this one. Each food is weighed on its own page as it is added,
/// so this sheet only ever shows finished rows — nothing on it is half-typed.
class ManualLogSheet extends ConsumerStatefulWidget {
  const ManualLogSheet({super.key, required this.userId, required this.date});

  final String userId;
  final String date;

  @override
  ConsumerState<ManualLogSheet> createState() => _ManualLogSheetState();
}

class _ManualLogSheetState extends ConsumerState<ManualLogSheet> {
  final TextEditingController _name = TextEditingController();
  String? _errorText;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _errorText = null);
    try {
      await ref
          .read(manualLogProvider.notifier)
          .save(userId: widget.userId, date: widget.date, name: _name.text);
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) setState(() => _errorText = 'errors.internal'.tr());
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(manualLogProvider);
    final saving = state.isSaving;
    final media = MediaQuery.of(context);
    final bottomInset = math.max(media.viewPadding.bottom, KalloSpacing.sp4);

    // Header and Save are pinned; only the plate between them scrolls, so
    // Save stays on screen on a short phone, in landscape and at 1.3x type.
    return KalloSheetSurface(
      color: kPage,
      constraints: BoxConstraints(
        maxHeight: (media.size.height - media.viewInsets.bottom) * 0.9,
      ),
      padding: const EdgeInsets.symmetric(horizontal: kSheetContentInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KalloSheetHeader(
            title: 'logging.manualLogging.title'.tr(),
            closeEnabled: !saving,
          ),
          Flexible(
            child: SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ManualNameField(
                    controller: _name,
                    enabled: !saving,
                    defaultTitle: defaultMealTitle(state.items),
                  ),
                  const SizedBox(height: 12),
                  ManualMealTotals(totals: state.totals),
                  ManualMealItems(
                    items: state.items,
                    onAdd: saving ? null : () => showManualAddSheet(context),
                    onOpen:
                        saving
                            ? null
                            : (item) =>
                                showManualAddSheet(context, editing: item),
                  ),
                  const SizedBox(height: KalloSpacing.sp6),
                ],
              ),
            ),
          ),
          const SizedBox(height: KalloSpacing.sp2),
          if (_errorText != null) ...[
            Text(
              _errorText!,
              textAlign: TextAlign.center,
              style: dashMeta(color: KalloColors.danger),
            ),
            const SizedBox(height: KalloSpacing.sp2),
          ],
          KalloButton(
            title: 'logging.manualLogging.save'.tr(),
            loading: saving,
            disabled: !state.canSave,
            onPressed: _save,
          ),
          SizedBox(height: bottomInset),
        ],
      ),
    );
  }
}
