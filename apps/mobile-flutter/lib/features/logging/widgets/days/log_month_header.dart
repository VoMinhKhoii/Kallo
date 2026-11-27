import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../shell/header/app_header_back_button.dart';
import '../../../../theme/calm_tokens.dart';
import 'log_month_chevron.dart';

/// The top of the days pane: the back chevron, the month on show ("November
/// 2026") and the chevrons that page it.
class LogMonthHeader extends StatelessWidget {
  const LogMonthHeader({
    super.key,
    required this.month,
    required this.onBack,
    required this.onPrevious,
    required this.onNext,
  });

  final DateTime month;
  final VoidCallback onBack;

  /// Null when there is no month to page to: the chevron stays, dimmed.
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
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
                      capitalizeFirst(DateFormat.MMMM(locale).format(month)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: kSectionHeader(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text('${month.year}', style: dashMeta()),
                ],
              ),
            ),
          ),
          LogMonthChevron(
            icon: LucideIcons.chevronLeft300,
            label: tr('logging.days.previousMonth'),
            onTap: onPrevious,
          ),
          LogMonthChevron(
            icon: LucideIcons.chevronRight300,
            label: tr('logging.days.nextMonth'),
            onTap: onNext,
          ),
        ],
      ),
    );
  }
}
