import 'package:flutter/widgets.dart';
import '../../logic/dashboard_spacing.dart';

/// A dashboard section: header + card, bound together on the
/// [DashboardSpacing.block] rhythm and pushed away from whatever precedes them
/// by [DashboardSpacing.sectionBreak].
///
/// The break is paid on TOP, by the section that needs it, rather than as a
/// trailing margin on the block above — so a section is separated by the fact
/// of being one, and the last section needs no special case to avoid a dead
/// gap under the scroll.
class DashboardSection extends StatelessWidget {
  const DashboardSection({
    super.key,
    required this.children,
    this.top = DashboardSpacing.sectionBreak,
  });
  final double top;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: top),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(height: DashboardSpacing.block),
            children[i],
          ],
        ],
      ),
    );
  }
}
