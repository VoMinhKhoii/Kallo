import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../data/session_provider.dart';
import '../../../../models/cheat.dart';
import '../../../../shared/widgets/nham_sheet.dart';
import '../../../../shared/widgets/nham_sheet_header.dart';
import '../../../../theme/nham_theme.dart';
import '../../data/logging_keys.dart';
import '../../data/logging_providers.dart';
import '../../logic/logging_spacing.dart';
import '../../logic/meal_log_mode.dart';
import '../cheat_intensity_row.dart';
import '../feed/composer_actions.dart';
import '../meal_input.dart';
import 'manual_log_sheet.dart';

/// Opens the quick-log sheet — the dashboard FAB's composer.
///
/// A modal sheet rather than a bar hanging off the FAB: it puts the keyboard up
/// over a stable surface instead of over a control the user can drag, and it
/// has the room to host the REAL [MealInput] the logging feed composes with.
///
/// It resolves to a ONE-SHOT mode when the user picks Manual or Barcode from
/// the mode selector inside it: the sheet pops ITSELF and hands the launch back
/// here, so the one-shot opens from the dashboard underneath rather than
/// stacking on a sheet that is on its way out. Normal / Cheat are persistent
/// modes — they never resolve the sheet, they only change what Send will do.
Future<void> showQuickLogSheet(BuildContext context, WidgetRef ref) async {
  final oneShot = await showNhamSheet<MealLogMode>(
    context,
    isScrollControlled: true,
    builder: (context) => const QuickLogSheet(),
  );
  if (oneShot == null || !context.mounted) return;

  final userId = ref.read(currentSessionProvider)?.user.id;
  if (userId == null) return;
  // A meal logged from the dashboard is a meal eaten now — today, the day the
  // dashboard is showing, is the only sensible target.
  final date = todayDateString();

  switch (oneShot) {
    case MealLogMode.manual:
      await showManualLogSheet(context, userId: userId, date: date);
    case MealLogMode.barcode:
      await openScanLogSheet(
        context,
        userId: userId,
        date: date,
        // Neither scan got us there → the AI composer is the better tool. From
        // here that means re-opening the sheet the user came from, caret in field.
        onFallbackToText: () {
          if (context.mounted) showQuickLogSheet(context, ref);
        },
      );
    case MealLogMode.normal:
    case MealLogMode.cheat:
      break; // persistent modes never resolve the sheet
  }
}

/// Type a meal here, land on the logging feed with it already being analyzed.
///
/// The sheet does not run the analysis itself: it parks the text in
/// [pendingMealProvider] and navigates to `/logging`, where the feed claims it
/// and pushes it through the same submit path as anything typed into the
/// composer. So one analysis pipeline, one set of failure/retry semantics.
///
/// The mode selector is the feed composer's, unforked: it reads and writes
/// [mealLogModeProvider], which is what the feed's analyze call reads too — so
/// picking "Cheat meal" here really does run the cheat estimator over there,
/// with no mode payload riding along with the parked text.
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
    // Same guard the manual/barcode branch already applies. Parking text for a
    // session that is already gone leaves it for whoever signs in next; the
    // router would bounce the navigation below anyway.
    if (ref.read(currentSessionProvider) == null) return;
    HapticFeedback.mediumImpact(); // commit cue
    ref.read(pendingMealProvider.notifier).state = meal;
    // Resolve the router BEFORE popping: after the pop this sheet's context is
    // defunct and `context.go` would look up a dead element.
    final router = GoRouter.of(context);
    Navigator.of(context).pop();
    router.go('/logging');
  }

  /// The same chooser the feed composer opens — one menu, one dispatch.
  Future<void> _openModeSheet() => chooseLogMode(
    context,
    current: ref.read(mealLogModeProvider),
    onPersistentMode: (mode) {
      ref.read(mealLogModeProvider.notifier).state = mode;
      _controller.focus();
    },
    onManual: () => _handOffOneShot(MealLogMode.manual),
    onBarcode: () => _handOffOneShot(MealLogMode.barcode),
  );

  /// A one-shot sheet must not open on top of this one: pop with the picked
  /// mode and let [showQuickLogSheet] launch it from the dashboard.
  void _handOffOneShot(MealLogMode mode) {
    if (mounted) Navigator.of(context).pop(mode);
  }

  void _setCheatIntensity(CheatIntensity intensity) {
    ref.read(cheatIntensityProvider.notifier).state = intensity;
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final keyboardInset = media.viewInsets.bottom;
    final bottomInset = media.padding.bottom;
    final mode = ref.watch(mealLogModeProvider);
    final isCheat = mode == MealLogMode.cheat;

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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Cheat magnitude sits above the field as it does on the
                  // feed: it silently scales the estimate, so it must be
                  // visible and changeable wherever cheat was chosen.
                  if (isCheat) ...[
                    CheatIntensityRow(
                      value: ref.watch(cheatIntensityProvider),
                      onChange: _setCheatIntensity,
                    ),
                    const SizedBox(height: LoggingSpacing.block),
                  ],
                  // No "log it again" chips here: they re-stage server-side and
                  // their only feedback is the seeded slider card on the FEED,
                  // so from the dashboard a tap would look like nothing.
                  MealInput(
                    controller: _controller,
                    onSubmit: _submit,
                    modeLabel: mealModeLabel(mode),
                    modeIcon: mealModeIcon(mode),
                    hintText: isCheat ? 'logging.cheatPlaceholder'.tr() : null,
                    onModePressed: _openModeSheet,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
