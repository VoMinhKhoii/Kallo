import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/social/circle.dart';
import '../../../../services/billing/feature_lock.dart';
import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/form/option_strip.dart' show OptionStripItem;
import '../../../../shared/widgets/form/segmented/segmented_strip.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../logging/data/logging_models.dart';
import '../../data/circle_providers.dart';
import '../../logic/split_parts.dart';
import '../states/friend_list_skeleton.dart';
import 'add_friend_row.dart';
import 'portion_battery.dart';

/// What the sheet did, handed back so the CALLER can confirm it.
@immutable
class ShareMealOutcome {
  const ShareMealOutcome({
    required this.mealId,
    required this.isSplit,
    required this.count,
  });

  final String mealId;
  final bool isSplit;
  final int count;
}

/// Opens the "share this meal" sheet: pick whether everyone gets a full
/// portion or the dish is divided, set who is at the table, and — on a split —
/// how much each of them had.
///
/// The confirmation toast is raised HERE, from [context], rather than inside
/// the sheet. Two reasons, both learned the hard way: the sheet's own context
/// is disposed moments after it pops, and a NavigatorState's context sits above
/// the overlay `showTopToast` searches, so a toast raised from either simply
/// never appears — taking the undo affordance with it. The opening context is
/// inside the overlay and outlives the sheet.
Future<void> showShareMealSheet(BuildContext context, PersistedMeal meal) async {
  final container = ProviderScope.containerOf(context, listen: false);
  final outcome = await showNhamSheet<ShareMealOutcome>(
    context,
    isScrollControlled: true,
    builder: (_) => _ShareMealSheet(meal: meal),
  );
  if (outcome == null || !context.mounted) return;

  showTopToast(
    context,
    (outcome.isSplit
            ? 'groups.shareMeal.splitSuccess'
            : 'groups.shareMeal.copySuccess')
        .plural(outcome.count, namedArgs: {'count': '${outcome.count}'}),
    // The undo rides on the confirmation rather than a separate surface: it is
    // only ever wanted in the seconds right after the tap.
    actionLabel: outcome.isSplit ? tr('groups.shareMeal.undo') : null,
    onAction: outcome.isSplit
        ? () => _runUndo(container, context, outcome.mealId)
        : null,
  );
}

/// Runs after the sheet is gone, so it holds no widget state — only a
/// container and a context that both outlive it.
Future<void> _runUndo(
  ProviderContainer container,
  BuildContext hostContext,
  String mealId,
) async {
  try {
    await undoMealShare(container, mealId);
  } catch (_) {
    // Refused (someone already accepted) or offline.
    if (!hostContext.mounted) return;
    showTopToast(
      hostContext,
      tr('groups.shareMeal.undoFailed'),
      variant: TopToastVariant.error,
    );
  }
}

class _ShareMealSheet extends ConsumerStatefulWidget {
  const _ShareMealSheet({required this.meal});

  final PersistedMeal meal;

  @override
  ConsumerState<_ShareMealSheet> createState() => _ShareMealSheetState();
}

class _ShareMealSheetState extends ConsumerState<_ShareMealSheet> {
  /// 'whole' — everyone logs a full serving. 'split' — one dish, divided.
  String _mode = 'whole';

  /// Seat order, seat 0 implicit (you). Friends in the order they were added,
  /// because the seat COLOUR is positional: it has to be stable while the
  /// table stands, and it has to close up when someone leaves.
  final List<CircleProfile> _seated = [];

  /// Parts per seat, index 0 being mine. Always sums to [kTotalParts].
  List<int> _parts = evenParts(2);

  bool _submitting = false;

  /// The lane holds its height so the footer never moves — not when the list
  /// is long, not when the tab changes.
  static const double _laneHeight = 150;

  double? get _totalKcal => widget.meal.nutrition.caloriesKcal;

  bool get _canSubmit => _seated.isNotEmpty && !_submitting;

  void _setMode(String mode) {
    if (mode == _mode) return;
    setState(() => _mode = mode);
  }

  void _add(CircleProfile profile) {
    if (_seated.length + 1 >= kMaxParticipants) return;
    setState(() {
      _seated.add(profile);
      _parts = _seated.length == 1
          ? evenParts(2)
          : partsAfterAdd(_parts);
    });
  }

  void _removeSeat(int seat) {
    // Seat 0 is me and carries no badge, so this is always a friend.
    setState(() {
      _seated.removeAt(seat - 1);
      _parts = _seated.isEmpty
          ? evenParts(2)
          : partsAfterRemoval(_parts, seat);
    });
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() => _submitting = true);
    final count = _seated.length;
    final isSplit = _mode == 'split';
    try {
      await shareMealWithFriends(
        ref,
        mealId: widget.meal.id,
        friendUserIds: _seated.map((p) => p.userId).toList(),
        mode: isSplit ? 'split' : 'copy',
        // ALWAYS send the parts for a split, even an untouched even one.
        //
        // Skipping them on "even" looked like a safe optimisation and was not:
        // 20 is not divisible by 3, so the meter draws an even three-way split
        // as 7/7/6 (35/35/30) while the server's no-parts path divides 20 by 3
        // exactly. The user confirmed one allocation and the database stored a
        // different one. Sending what the meter shows makes the two agree by
        // construction, and the two-person case is 10/10 either way.
        myParts: isSplit ? _parts.first : null,
        splits: isSplit
            ? [
                for (var i = 0; i < _seated.length; i++)
                  {'userId': _seated[i].userId, 'parts': _parts[i + 1]},
              ]
            : null,
      );
      if (!mounted) return;
      // Hand the outcome back; the caller raises the toast from a context that
      // is inside the overlay and still alive when the undo fires.
      Navigator.of(context).pop(
        ShareMealOutcome(
          mealId: widget.meal.id,
          isSplit: isSplit,
          count: count,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      // The draft survives a failure: a retry should be one tap, not a rebuild.
      setState(() => _submitting = false);
      if (handledFeatureLock(context, error)) return;
      showTopToast(
        context,
        tr('groups.shareMeal.error'),
        variant: TopToastVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets.bottom;
    final maxHeight = (MediaQuery.of(context).size.height - viewInsets) * 0.9;
    final friendsAsync = ref.watch(circleFriendsProvider);

    return KalloSheetSurface(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          KalloSheetHeader(
            title: tr('groups.shareMeal.title'),
            subtitle: widget.meal.rawInput,
            closeEnabled: !_submitting,
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                KalloSpacing.sp4,
                KalloSpacing.sp2,
                KalloSpacing.sp4,
                0,
              ),
              child: friendsAsync.when(
                loading: () => FriendListSkeleton(
                  semanticsLabel: tr('groups.shareMeal.loadingFriends'),
                ),
                error: (_, __) => KalloSurfaceState(
                  area: SurfaceArea.circle,
                  kind: SurfaceKind.error,
                  compact: true,
                  title: tr('groups.error.title'),
                  subtitle: tr('groups.error.body'),
                  action: KalloButton(
                    variant: KalloButtonVariant.cta,
                    title: tr('groups.error.retry'),
                    onPressed: () => ref.invalidate(circleFriendsProvider),
                  ),
                ),
                data: (members) {
                  final friends =
                      members.where((m) => m.isAccepted).toList();
                  if (friends.isEmpty) {
                    // The one state that must not be a dead end.
                    return KalloSurfaceState(
                      area: SurfaceArea.circle,
                      kind: SurfaceKind.empty,
                      compact: true,
                      title: tr('groups.shareMeal.emptyTitle'),
                      subtitle: tr('groups.shareMeal.emptyBody'),
                      action: KalloButton(
                        variant: KalloButtonVariant.cta,
                        title: tr('groups.shareMeal.addFriends'),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    );
                  }
                  return _body(friends);
                },
              ),
            ),
          ),
          _footer(),
        ],
      ),
    );
  }

  Widget _body(List<CircleMember> friends) {
    final unseated = friends
        .where((m) => !_seated.any((s) => s.userId == m.profile.userId))
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SegmentedStrip(
          options: [
            OptionStripItem(
              value: 'whole',
              label: tr('groups.shareMeal.mode.whole'),
            ),
            OptionStripItem(
              value: 'split',
              label: tr('groups.shareMeal.mode.split'),
            ),
          ],
          activeIndex: _mode == 'whole' ? 0 : 1,
          onChange: _setMode,
        ),
        const SizedBox(height: KalloSpacing.sp4),
        // The meter's height differs between the two modes, so the change is
        // animated rather than a jump the eye reads as a relayout.
        AnimatedSize(
          duration: KalloMotion.quick,
          curve: Curves.easeOut,
          alignment: Alignment.topCenter,
          child: _meter(),
        ),
        const SizedBox(height: KalloSpacing.sp4),
        Text(tr('groups.shareMeal.addSectionTitle'), style: dashMeta()),
        SizedBox(
          height: _laneHeight,
          child: unseated.isEmpty
              ? Align(
                  alignment: Alignment.topLeft,
                  child: Padding(
                    padding: const EdgeInsets.only(top: KalloSpacing.sp3),
                    child: Text(
                      tr('groups.shareMeal.allAdded'),
                      style: dashMeta(),
                    ),
                  ),
                )
              : ListView.builder(
                  padding: EdgeInsets.zero,
                  itemCount: unseated.length,
                  itemBuilder: (_, i) => AddFriendRow(
                    profile: unseated[i].profile,
                    // Past the palette there is no seat to give them.
                    enabled: _seated.length + 1 < kMaxParticipants,
                    onTap: () => _add(unseated[i].profile),
                  ),
                ),
        ),
      ],
    );
  }

  Widget _meter() {
    if (_seated.isEmpty) {
      return Text(tr('groups.shareMeal.pickSomeone'), style: dashMeta());
    }
    final seats = [
      PortionSeat(
        id: 'me',
        initials: tr('groups.shareMeal.youInitial'),
        label: tr('groups.shareMeal.you'),
        parts: _parts.first,
      ),
      for (var i = 0; i < _seated.length; i++)
        PortionSeat(
          id: _seated[i].userId,
          initials: _initials(_seated[i]),
          label: _seated[i].label,
          parts: _parts[i + 1],
        ),
    ];

    if (_mode == 'whole') {
      // Nothing is divided, so nothing is drawn divided: one full battery per
      // person, at the same unit size the split meter uses.
      return WholePortionBatteries(seats: seats, totalKcal: _totalKcal);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PortionBattery(
          seats: seats,
          totalKcal: _totalKcal,
          onChanged: (parts) => setState(() => _parts = parts),
          onRemove: _removeSeat,
        ),
        const SizedBox(height: KalloSpacing.sp2),
        Align(
          alignment: Alignment.centerRight,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () =>
                setState(() => _parts = evenParts(_seated.length + 1)),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                vertical: KalloSpacing.sp1,
                horizontal: KalloSpacing.sp1,
              ),
              child: Text(
                tr('groups.shareMeal.splitEvenly'),
                style: dashMeta(color: kInk),
              ),
            ),
          ),
        ),
      ],
    );
  }

  static String _initials(CircleProfile p) {
    final source = (p.displayName?.trim().isNotEmpty ?? false)
        ? p.displayName!.trim()
        : p.handle;
    final words = source.split(RegExp(r'\s+'));
    if (words.length >= 2) {
      return (words[words.length - 2][0] + words.last[0]).toUpperCase();
    }
    return source.characters.take(2).toString().toUpperCase();
  }

  Widget _footer() {
    // My own kcal after the share: the whole consequence, on the button.
    final keptParts = _mode == 'split' && _seated.isNotEmpty
        ? _parts.first
        : kTotalParts;
    final kept = _totalKcal == null
        ? null
        : (_totalKcal! * keptParts / kTotalParts).round();

    final label = _seated.isEmpty
        ? tr('groups.shareMeal.submitEmpty')
        : kept == null
            ? 'groups.shareMeal.submitNoKcal'
                .plural(_seated.length, namedArgs: {'count': '${_seated.length}'})
            : 'groups.shareMeal.submit'.plural(
                _seated.length,
                namedArgs: {'count': '${_seated.length}', 'kcal': '$kept'},
              );

    return Container(
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: KalloColors.borderFaint)),
      ),
      padding: const EdgeInsets.fromLTRB(
        KalloSpacing.sp4,
        KalloSpacing.sp3,
        KalloSpacing.sp4,
        KalloSpacing.sp5,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          KalloButton(
            title: label,
            animateTitle: true,
            loading: _submitting,
            disabled: !_canSubmit,
            onPressed: _submit,
          ),
          const SizedBox(height: KalloSpacing.sp2),
          KalloButton(
            variant: KalloButtonVariant.ghost,
            title: tr('common.cancel'),
            disabled: _submitting,
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }
}
