import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../services/auth/session_provider.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/logging_keys.dart';
import '../../data/logging_providers.dart';
import '../../logic/logging_spacing.dart';
import '../../logic/meal_log_mode.dart';
import '../cheat/cheat_intensity_group.dart';
import '../composer/composer_actions.dart';
import '../composer/meal_input.dart';
import 'manual/manual_log_sheet.dart';
import '../../../../shell/nav/nav_actions.dart';

/// Opens the quick-log sheet — the dashboard FAB's composer.
///
/// A modal sheet rather than a bar hanging off the FAB: the keyboard comes up
/// over a stable surface instead of over a control the user can drag, and
/// there is room for the REAL [MealInput] the logging feed composes with.
///
/// It resolves to a ONE-SHOT mode when the user picks Manual or Barcode inside
/// it: the sheet pops ITSELF and hands the launch back here, so the one-shot
/// opens from the dashboard rather than stacking on a sheet on its way out.
/// Normal / Cheat are persistent — they only change what Send does.
Future<void> showQuickLogSheet(BuildContext context, WidgetRef ref) async {
  final oneShot = await showNhamSheet<MealLogMode>(
    context,
    isScrollControlled: true,
    builder: (context) => const QuickLogSheet(),
  );
  if (oneShot == null || !context.mounted) return;

  final userId = ref.read(currentSessionProvider)?.user.id;
  if (userId == null) return;
  // A meal logged from the dashboard is eaten now: today is the only target.
  final date = todayDateString();

  switch (oneShot) {
    case MealLogMode.manual:
      await showManualLogSheet(context, userId: userId, date: date);
    case MealLogMode.barcode:
      await openScanLogSheet(
        context,
        userId: userId,
        date: date,
        // Neither scan got us there → re-open the sheet, caret in the field.
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
/// It parks the text in [pendingMealProvider] and navigates to `/logging`,
/// where the feed claims it and submits it — one pipeline, one retry story.
///
/// The mode selector is the feed composer's, unforked: it reads and writes
/// [mealLogModeProvider], so "Cheat meal" here runs the cheat estimator there.
class QuickLogSheet extends ConsumerStatefulWidget {
  const QuickLogSheet({super.key});

  @override
  ConsumerState<QuickLogSheet> createState() => _QuickLogSheetState();
}

class _QuickLogSheetState extends ConsumerState<QuickLogSheet> {
  final MealInputController _controller = MealInputController();

  /// This sheet's own route; [_entry] is its entrance while listened to.
  ModalRoute<dynamic>? _route;
  Animation<double>? _entry;
  bool _entryHandled = false;
  bool _submitted = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _route = ModalRoute.of(context);
    if (_entryHandled) return;
    _entryHandled = true;
    // Focusing on the FIRST post-frame climbs the keyboard against a moving
    // sheet (the route is still sliding up): wait for the entrance instead.
    final entry = _route?.animation;
    if (entry == null || entry.isCompleted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _controller.focus();
      });
      return;
    }
    _entry = entry..addStatusListener(_onEntryStatus);
  }

  void _onEntryStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed) return;
    _entry?.removeStatusListener(_onEntryStatus);
    if (mounted) _controller.focus();
  }

  @override
  void dispose() {
    _entry?.removeStatusListener(_onEntryStatus);
    super.dispose();
  }

  void _submit(String text) {
    final meal = text.trim();
    if (meal.isEmpty) return;
    // Same guard the manual/barcode branch applies: parking text for a session
    // that is already gone leaves it for whoever signs in next.
    if (ref.read(currentSessionProvider) == null) return;
    if (_submitted) return; // a double-tap on Send must not push /logging twice
    _submitted = true;
    HapticFeedback.mediumImpact(); // commit cue
    ref.read(pendingMealProvider.notifier).state = meal;
    // Push FIRST, retire the sheet after: popping first raced three animations
    // on one frame (keyboard, slide-down, push). `/logging` slides in OVER the
    // sheet, which is removed silently under it.
    final route = _route;
    openLogging(GoRouter.of(context));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (route != null && route.isActive) route.navigator?.removeRoute(route);
    });
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

  /// [showQuickLogSheet] opens the one-shot after this sheet pops with it.
  void _handOffOneShot(MealLogMode mode) {
    if (mounted) Navigator.of(context).pop(mode);
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final mode = ref.watch(mealLogModeProvider);
    final isCheat = mode == MealLogMode.cheat;

    // `KalloSheetSurface` lifts itself clear of the keyboard; the insets are
    // read here only to size the bottom gap. Stretch: the composer fills it.
    return KalloSheetSurface(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KalloSheetHeader(title: 'logging.quickLog.title'.tr()),
          Padding(
            padding: EdgeInsets.fromLTRB(
              KalloSpacing.sp4,
              KalloSpacing.sp2,
              KalloSpacing.sp4,
              // ONE continuous ramp, never a branch — see the helper's doc.
              LoggingSpacing.quickLogGap(
                bottomInset: media.viewPadding.bottom,
                keyboardInset: media.viewInsets.bottom,
              ),
            ),
            // No "log it again" chips here: they re-stage server-side and their
            // only feedback is a card on the FEED, so a tap would look inert.
            child: MealInput(
              controller: _controller,
              onSubmit: _submit,
              modeLabel: mealModeLabel(mode),
              modeDetail: isCheat
                  ? cheatIntensityLabel(ref.watch(cheatIntensityProvider))
                  : null,
              modeIcon: mealModeIcon(mode),
              hintText: isCheat ? 'logging.cheatPlaceholder'.tr() : null,
              onModePressed: _openModeSheet,
              // The same one-shot hand-off the mode sheet's Barcode row takes.
              onBarcodePressed: isBarcodeLoggingSupported
                  ? () => _handOffOneShot(MealLogMode.barcode)
                  : null,
            ),
          ),
        ],
      ),
    );
  }
}
