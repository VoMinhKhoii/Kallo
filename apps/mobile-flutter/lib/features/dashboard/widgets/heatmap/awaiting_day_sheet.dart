/// The awaiting (under-logged) heatmap day, opened by tapping its cell: the
/// day's meals for the user to recall, and the one-way "Mình ăn đủ rồi" the
/// logging feed offers. Twin of web
/// `components/dashboard/heatmap-day/awaiting-day-dialog.tsx`.
///
/// The sheet is itself the confirmation step — the meals are in front of the
/// user, and the line above the button says it can't be undone — so there is
/// no second dialog, and the header's close is the way out.
library;

import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/profile/heatmap.dart';
import '../../../../shared/logic/display_format.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../shared/widgets/surface/kallo_button.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../logging/data/mutations/day_completion_mutation.dart';
import '../../data/dashboard_providers.dart';
import '../today/today_meal_list.dart';

const _notice = 'logging.feedArea.partialDayNotice';

Future<void> showAwaitingDaySheet(
  BuildContext context, {
  required DashboardArgs args,
  required HeatmapCell cell,
}) {
  HapticFeedback.lightImpact();
  return showNhamSheet<void>(
    context,
    builder: (_) => _AwaitingDaySheet(args: args, cell: cell),
  );
}

class _AwaitingDaySheet extends ConsumerStatefulWidget {
  const _AwaitingDaySheet({required this.args, required this.cell});

  /// The dashboard's own args — today's date, which keys the heatmap.
  final DashboardArgs args;
  final HeatmapCell cell;

  @override
  ConsumerState<_AwaitingDaySheet> createState() => _AwaitingDaySheetState();
}

class _AwaitingDaySheetState extends ConsumerState<_AwaitingDaySheet> {
  bool _pending = false;

  Future<void> _confirm() async {
    setState(() => _pending = true);
    // Captured before the await: the user can swipe the sheet away while the
    // request is in flight, and the heatmap must still refresh after.
    final scope = ProviderScope.containerOf(context, listen: false);
    final ok = await markDayComplete(
      context,
      userId: widget.args.userId,
      date: widget.cell.date,
    );
    if (ok) {
      // markDayComplete refreshes the surfaces keyed on the MARKED day; the
      // heatmap is keyed on today, so it is refreshed here or the cell keeps
      // its ring.
      scope.invalidate(dashboardBundleProvider(widget.args));
      scope.invalidate(heatmapProvider(widget.args));
    }
    if (!mounted) return;
    if (!ok) {
      setState(() => _pending = false);
      return;
    }
    // A swipe-away still animating leaves this state mounted with its route
    // already popped; popping again would take the screen beneath with it.
    if (ModalRoute.of(context)?.isCurrent ?? false) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final locale = localeOf(context);
    final cell = widget.cell;
    final calories = formatCount((cell.calories ?? 0).round(), locale);
    final target =
        ref
            .watch(dashboardBundleProvider(widget.args))
            .valueOrNull
            ?.profile
            ?.calorieTarget;
    final isToday = cell.date == widget.args.date;
    final day = ref.watch(
      dashboardDayProvider((userId: widget.args.userId, date: cell.date)),
    );
    final title = DateFormat(
      'EEEE, MMMM d',
      locale,
    ).format(DateTime.parse(cell.date));

    return KalloSheetSurface(
      scrollable: true,
      padding: EdgeInsets.only(
        left: KalloSpacing.sp4,
        right: KalloSpacing.sp4,
        bottom: math.max(
          MediaQuery.viewPaddingOf(context).bottom,
          KalloSpacing.sp4,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KalloSheetHeader(title: title, closeEnabled: !_pending),
          if (target != null)
            Text(
              '$_notice.body'.tr(
                namedArgs: {
                  'calories': calories,
                  'target': formatCount(target.round(), locale),
                },
              ),
              style: dashMeta(color: kInkMuted),
            ),
          day.when(
            skipLoadingOnReload: true,
            loading:
                () => const Padding(
                  padding: EdgeInsets.all(KalloSpacing.sp6),
                  child: Center(child: CircularProgressIndicator.adaptive()),
                ),
            error:
                (_, __) => Padding(
                  padding: const EdgeInsets.symmetric(
                    vertical: KalloSpacing.sp4,
                  ),
                  child: Text(
                    tr('dashboard.adherenceHeatmap.dayDialog.loadError'),
                    style: dashMeta(color: kInkMuted),
                  ),
                ),
            // Oldest first: the order the day was eaten in, which is how a
            // user checks it for a missing meal.
            data: (d) => MealList(meals: d.persistedMeals.reversed.toList()),
          ),
          const SizedBox(height: KalloSpacing.sp2),
          Text(
            isToday
                ? tr('dashboard.adherenceHeatmap.dayDialog.todayNote')
                : '$_notice.confirmBody'.tr(namedArgs: {'calories': calories}),
            style: dashMeta(color: kInkMuted),
          ),
          if (!isToday) ...[
            const SizedBox(height: KalloSpacing.sp4),
            KalloButton(
              title: '$_notice.confirmAccept'.tr(),
              loading: _pending,
              onPressed: _pending ? null : _confirm,
            ),
          ],
        ],
      ),
    );
  }
}
