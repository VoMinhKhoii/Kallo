import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/logging/cheat.dart';
import '../../../../services/billing/entitlement_state.dart';
import '../../../../services/billing/feature_lock.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_sub_header.dart';
import '../../../../shared/widgets/sheet/sheet_page_swap.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/logging_providers.dart';
import '../../logic/meal_log_mode.dart';
import '../cheat/cheat_intensity_group.dart';
import 'meal_mode_row.dart';

/// Opens the "select mode" chooser — the first step before the composer.
/// Returns the picked mode (or null if dismissed).
Future<MealLogMode?> showMealModeSheet(
  BuildContext context, {
  required MealLogMode current,
}) {
  return showNhamSheet<MealLogMode>(
    context,
    builder: (context) => _MealModeSheet(current: current),
  );
}

/// The mode rows in the app's shared row anatomy (native pass, 2026-08-31):
/// leading 24pt ink glyph, 14/500 title over a 12 muted description (64pt with
/// the subline), an ink check on the chosen one.
///
/// The icons lost their per-mode colours here: the palette keeps tan and umber
/// for non-text moments, and four differently-tinted glyphs in one list read as
/// four categories rather than one choice. Selection carries the state instead.
class _MealModeSheet extends ConsumerStatefulWidget {
  const _MealModeSheet({required this.current});

  final MealLogMode current;

  @override
  ConsumerState<_MealModeSheet> createState() => _MealModeSheetState();
}

class _MealModeSheetState extends ConsumerState<_MealModeSheet> {
  /// The sheet's own one-deep navigation. A nested [Navigator] would swallow
  /// the `pop(mode)` this sheet answers with, and a second `showNhamSheet`
  /// would stack a surface on a surface — so the ONE sheet swaps its content.
  bool _onIntensity = false;

  void _open() => setState(() => _onIntensity = true);
  void _back() => setState(() => _onIntensity = false);

  @override
  Widget build(BuildContext context) {
    // Every watch up front, once — never from a tap callback or one page only.
    final gates = _gates();
    final intensity = ref.watch(cheatIntensityProvider);
    // Floors at sp4 for phones with no home indicator to inset against.
    final bottomInset = math.max(
      MediaQuery.viewPaddingOf(context).bottom,
      KalloSpacing.sp4,
    );
    return KalloSheetSurface(
      // Four description rows overflowed a short phone at large Dynamic Type
      // (104px past the old 9/16 cap) — the last mode was unreachable.
      scrollable: true,
      padding: EdgeInsets.only(
        left: KalloSpacing.sp4,
        right: KalloSpacing.sp4,
        bottom: bottomInset,
      ),
      // Back closes the page before it closes the sheet, which is what a user
      // who pushed one level expects the gesture to undo.
      child: PopScope(
        canPop: !_onIntensity,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop && _onIntensity) _back();
        },
        child: SheetPageSwap(
          isSecondLevel: _onIntensity,
          child:
              _onIntensity
                  ? _intensityPage(intensity)
                  : _modeList(gates, intensity),
        ),
      ),
    );
  }

  Widget _modeList(
    Map<MealLogMode, PremiumGate> gates,
    CheatIntensity intensity,
  ) => Column(
    key: const ValueKey('modes'),
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      KalloSheetHeader(title: 'logging.modeSelector.title'.tr()),
      for (final mode in MealLogMode.values)
        if (mode != MealLogMode.barcode || isBarcodeLoggingSupported)
          MealModeRow(
            mode: mode,
            selected: widget.current == mode,
            locked: gates[mode]!.locked,
            onTap: () {
              HapticFeedback.selectionClick();
              // A locked mode goes straight to pricing, over the sheet: back
              // from the paywall lands on this same choice, with the marker
              // gone if the user just bought.
              gates[mode]!.tap(
                context,
                () => Navigator.of(context).pop(mode),
              )!();
            },
          ),
      // Cheat's magnitude is a property OF the cheat mode, so it hangs off the
      // mode list as its own grouped card — the iOS "Effort … Medium ›" shape.
      // It writes straight through to the provider the analyze call reads, so
      // the choice survives this sheet closing.
      if (widget.current == MealLogMode.cheat) ...[
        const SizedBox(height: KalloSpacing.sp3),
        CheatIntensityGroup(value: intensity, onOpen: _open),
      ],
    ],
  );

  /// Instant and Cheat are the gated modes; Manual and Scan are free (the
  /// label half of Scan carries its own marker on the scan sheet's toggle).
  Map<MealLogMode, PremiumGate> _gates() {
    const free = PremiumGate(locked: false);
    final instant = premiumGate(ref, PremiumFeature.aiAnalysis);
    final cheat = premiumGate(ref, PremiumFeature.cheatMeal);
    return {
      for (final mode in MealLogMode.values)
        mode: switch (mode) {
          MealLogMode.normal => instant,
          MealLogMode.cheat => cheat,
          MealLogMode.manual || MealLogMode.barcode => free,
        },
    };
  }

  Widget _intensityPage(CheatIntensity intensity) => Column(
    key: const ValueKey('intensity'),
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      KalloSheetSubHeader(
        title: 'logging.cheatIntensity.title'.tr(),
        parentTitle: 'logging.modeSelector.title'.tr(),
        onBack: _back,
      ),
      const SizedBox(height: KalloSpacing.sp2),
      CheatIntensityPage(
        value: intensity,
        onChange: (intensity) {
          ref.read(cheatIntensityProvider.notifier).state = intensity;
          _back();
        },
      ),
    ],
  );
}
