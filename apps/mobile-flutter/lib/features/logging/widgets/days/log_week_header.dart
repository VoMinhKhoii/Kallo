import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../shell/header/app_header_back_button.dart';
import '../../../../theme/calm_tokens.dart';
import 'log_week_chevron.dart';

/// The top of the days pane: the back chevron, the month the week on show
/// falls in ("November 2026", or "Nov – Dec 2026" across two) and the
/// chevrons that page it a week at a time.
class LogWeekHeader extends StatelessWidget {
  const LogWeekHeader({
    super.key,
    required this.week,
    required this.onBack,
    required this.onPrevious,
    required this.onNext,
  });

  /// The Monday of the week on show.
  final DateTime week;
  final VoidCallback onBack;

  /// Null when there is no week to page to: the chevron stays, dimmed.
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final last = DateTime(week.year, week.month, week.day + 6);
    // One month's name, or both when the week runs across two.
    final name =
        last.month == week.month
            ? DateFormat.MMMM(locale).format(week)
            : '${DateFormat.MMM(locale).format(week)} – '
                '${DateFormat.MMM(locale).format(last)}';
    return SizedBox(
      height: 44,
      child: Row(
        children: [
          AppHeaderBackButton(onBack: onBack),
          Expanded(
            child: Semantics(
              header: true,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Flexible(
                    child: Text(
                      capitalizeFirst(name),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: kSectionHeader(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text('${last.year}', style: dashMeta()),
                ],
              ),
            ),
          ),
          LogWeekChevron(
            icon: LucideIcons.chevronLeft300,
            label: tr('logging.days.previousWeek'),
            onTap: onPrevious,
          ),
          LogWeekChevron(
            icon: LucideIcons.chevronRight300,
            label: tr('logging.days.nextWeek'),
            onTap: onNext,
          ),
        ],
      ),
    );
  }
}
