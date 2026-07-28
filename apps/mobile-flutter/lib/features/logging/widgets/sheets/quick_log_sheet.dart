import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/widgets/nham_sheet.dart';
import '../../../../theme/nham_theme.dart';
import '../../data/logging_providers.dart';
import '../meal_input.dart';

/// Opens the quick-log sheet — the dashboard FAB's composer.
///
/// A modal sheet rather than a bar hanging off the FAB: a sheet is the idiom
/// every other compose-and-commit flow in the app already uses (mode, manual,
/// barcode), it puts the keyboard up over a stable surface instead of over a
/// control the user can drag, and it has the room to host the REAL
/// [MealInput] — the same growing multiline field and send button the logging
/// feed composes with.
Future<void> showQuickLogSheet(BuildContext context) {
  return showNhamSheet<void>(
    context,
    isScrollControlled: true,
    builder: (context) => const QuickLogSheet(),
  );
}

/// Type a meal here, land on the logging feed with it already being analyzed.
///
/// The sheet does not run the analysis itself: it parks the text in
/// [pendingMealProvider] and navigates to `/logging`, where the feed claims it
/// and pushes it through the same submit path as anything typed into the
/// composer. So one analysis pipeline, one set of failure/retry semantics.
class QuickLogSheet extends ConsumerStatefulWidget {
  const QuickLogSheet({super.key});

  @override
  ConsumerState<QuickLogSheet> createState() => _QuickLogSheetState();
}

class _QuickLogSheetState extends ConsumerState<QuickLogSheet> {
  final MealInputController _controller = MealInputController();

  @override
  void initState() {
    super.initState();
    // The sheet exists to be typed into — open with the caret already in it.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _controller.focus();
    });
  }

  void _submit(String text) {
    final meal = text.trim();
    if (meal.isEmpty) return;
    HapticFeedback.mediumImpact(); // commit cue
    ref.read(pendingMealProvider.notifier).state = meal;
    // Resolve the router BEFORE popping: after the pop this sheet's context is
    // defunct and `context.go` would look up a dead element.
    final router = GoRouter.of(context);
    Navigator.of(context).pop();
    router.go('/logging');
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final keyboardInset = media.viewInsets.bottom;
    final bottomInset = media.padding.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: keyboardInset),
      child: NhamSheetSurface(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            NhamSheetHeader(
              title: 'logging.quickLog.title'.tr(),
              subtitle: 'logging.quickLog.subtitle'.tr(),
            ),
            Padding(
              // The keyboard's inset already clears the home indicator when it
              // is up; only pay the safe-area bottom when it is down.
              padding: EdgeInsets.fromLTRB(
                NhamSpacing.sp3,
                NhamSpacing.sp2,
                NhamSpacing.sp3,
                (keyboardInset > 0 ? 0 : bottomInset) + NhamSpacing.sp4,
              ),
              // Mode selector and barcode are deliberately absent: both are
              // stateful properties OF the feed (the persistent mode and cheat
              // intensity that `startMealAnalysis` reads, the scanner's
              // save-straight-to-a-day path). Offering them here would mean
              // duplicating that state and a second hand-off to carry it over.
              // Text + send is the whole job of this sheet; everything else is
              // one tap away on the feed it lands on.
              child: MealInput(controller: _controller, onSubmit: _submit),
            ),
          ],
        ),
      ),
    );
  }
}
