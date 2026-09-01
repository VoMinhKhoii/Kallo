import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/list/list_row.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_sub_header.dart';
import '../../../../shared/widgets/sheet/sheet_page_swap.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/logging_providers.dart';
import '../../logic/meal_log_mode.dart';
import '../cheat/cheat_intensity_group.dart';

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
          child: _onIntensity ? _intensityPage() : _modeList(),
        ),
      ),
    );
  }

  Widget _modeList() => Column(
    key: const ValueKey('modes'),
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      KalloSheetHeader(title: 'logging.modeSelector.title'.tr()),
      for (final mode in MealLogMode.values)
        if (mode != MealLogMode.barcode || isBarcodeLoggingSupported)
          _ModeRow(
            mode: mode,
            selected: widget.current == mode,
            onTap: () {
              HapticFeedback.selectionClick();
              Navigator.of(context).pop(mode);
            },
          ),
      // Cheat's magnitude is a property OF the cheat mode, so it hangs off the
      // mode list as its own grouped card — the iOS "Effort … Medium ›" shape.
      // It writes straight through to the provider the analyze call reads, so
      // the choice survives this sheet closing.
      if (widget.current == MealLogMode.cheat) ...[
        const SizedBox(height: KalloSpacing.sp3),
        CheatIntensityGroup(
          value: ref.watch(cheatIntensityProvider),
          onOpen: _open,
        ),
      ],
    ],
  );

  Widget _intensityPage() => Column(
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
        value: ref.watch(cheatIntensityProvider),
        onChange: (intensity) {
          ref.read(cheatIntensityProvider.notifier).state = intensity;
          _back();
        },
      ),
    ],
  );
}

class _ModeRow extends StatelessWidget {
  const _ModeRow({
    required this.mode,
    required this.selected,
    required this.onTap,
  });

  final MealLogMode mode;
  final bool selected;
  final VoidCallback onTap;

  static String _key(MealLogMode mode) => switch (mode) {
    MealLogMode.normal => 'normal',
    MealLogMode.cheat => 'cheat',
    MealLogMode.manual => 'manual',
    MealLogMode.barcode => 'barcode',
  };

  @override
  Widget build(BuildContext context) {
    final key = _key(mode);
    // The tick alone marks the choice. The beige wash this row used to carry
    // was the SAME colour ListRow paints while pressed, so pressing an
    // unselected row made it look chosen for as long as the finger was down —
    // and the wrapper the fill needed for its rounded ends pushed these rows
    // 8pt right of every other row in the app, and of the header's X.
    return ListRow(
      icon: mealModeIcon(mode),
      label: 'logging.modeSelector.$key'.tr(),
      subline: 'logging.modeSelector.${key}Desc'.tr(),
      onTap: onTap,
      trailing: selected
          ? const Icon(
              LucideIcons.check300,
              size: KalloIcons.size,
              color: KalloColors.text,
            )
          : null,
    );
  }
}
