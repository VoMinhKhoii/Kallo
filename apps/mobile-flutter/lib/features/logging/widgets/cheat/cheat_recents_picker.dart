import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/logging/cheat.dart';
import '../../../../services/billing/entitlement_state.dart';
import '../../../../services/billing/feature_lock.dart';
import '../../../../shared/logic/display_format.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/logging_providers.dart';
import '../../logic/cheat/occasion_search.dart';
import '../picker/picker_band.dart';
import '../picker/picker_option.dart';

/// Cheat mode's "log it again": recent past occasions on the `/` picker's band,
/// in `MealInput`'s `popupSlot` — the slot that yields to the field, so a long
/// list scrolls instead of pushing the composer under the keyboard (which the
/// chips it replaced did, stacked in a column above the input).
///
/// There is no `/` here: the field itself is the query, filtered on the device
/// ([filterCheatOccasions]). When nothing matches — you are typing a new meal —
/// the band is simply not there. Tapping a row re-stages that occasion's
/// sliders, seeded with last time's amounts, without an AI call.
///
/// When the plan lacks `cheat_meal` the close row carries a premium chip and a
/// tap opens the paywall instead of re-staging.
class CheatRecentsPicker extends ConsumerStatefulWidget {
  const CheatRecentsPicker({
    super.key,
    required this.userId,
    required this.text,
    required this.disabled,
    required this.onSelect,
  });

  final String userId;

  /// The composer's text — the search query.
  final ValueListenable<TextEditingValue> text;

  /// A re-stage or an analysis is in flight: rows dim and stop taking taps.
  final bool disabled;
  final ValueChanged<RecentCheatOccasion> onSelect;

  @override
  ConsumerState<CheatRecentsPicker> createState() => _CheatRecentsPickerState();
}

class _CheatRecentsPickerState extends ConsumerState<CheatRecentsPicker> {
  /// Closed by its X, or by collapsing for lack of room. Stays closed while
  /// you type on; clearing the field re-opens it, the way a fresh `/` re-opens
  /// the relog picker.
  bool _dismissed = false;

  @override
  void initState() {
    super.initState();
    widget.text.addListener(_onText);
  }

  @override
  void didUpdateWidget(CheatRecentsPicker old) {
    super.didUpdateWidget(old);
    if (old.text != widget.text) {
      old.text.removeListener(_onText);
      widget.text.addListener(_onText);
    }
  }

  @override
  void dispose() {
    widget.text.removeListener(_onText);
    super.dispose();
  }

  void _onText() {
    if (_dismissed && widget.text.value.text.trim().isEmpty) {
      setState(() => _dismissed = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Watched BEFORE the dismissed early-out: the provider is autoDispose, so
    // a closed band that stopped watching would drop the list, and clearing
    // the field would re-open onto an empty band while it refetched.
    final occasions =
        ref.watch(recentCheatOccasionsProvider(widget.userId)).valueOrNull ??
        const <RecentCheatOccasion>[];
    if (_dismissed) return const SizedBox.shrink();
    final gate = premiumGate(ref, PremiumFeature.cheatMeal);
    // Only this subtree rebuilds per keystroke, never the dock around it.
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: widget.text,
      builder: (context, value, _) {
        final matches = filterCheatOccasions(occasions, value.text);
        if (matches.isEmpty) return const SizedBox.shrink();
        return PickerBand(
          title: 'logging.cheatRepeat.title'.tr(),
          locked: gate.locked,
          onDismiss: () => setState(() => _dismissed = true),
          body: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.all(KalloSpacing.sp2).copyWith(top: 0),
            children: [
              for (final occasion in matches)
                PickerOption(
                  key: ValueKey(occasion.mealId),
                  title: occasion.rawInput,
                  subtitle: _when(occasion.loggedAt, localeOf(context)),
                  kcal: occasion.caloriesKcal,
                  // Locked wins: a busy composer must not swallow the route
                  // to the paywall.
                  enabled: !widget.disabled || gate.locked,
                  onSelect: gate.tap(context, () => widget.onSelect(occasion))!,
                ),
            ],
          ),
        );
      },
    );
  }
}

/// `Sat, Sep 27 · 8:14 PM` — the day AND the time, because a cheat occasion is
/// remembered by when it happened ("Saturday's dinner"), not by its macros.
String _when(String loggedAt, String locale) {
  final at = DateTime.tryParse(loggedAt)?.toLocal();
  if (at == null) return '';
  final day = DateFormat('EEE, MMM d', locale).format(at);
  return '$day · ${formatLoggedTime(at, locale: locale)}';
}
