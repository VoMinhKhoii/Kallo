import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/chrome/inline_nav_bar.dart';
import '../../../shared/widgets/chrome/underline_tab_bar.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../data/circle_providers.dart';
import '../widgets/manage/circle_tab.dart';
import '../widgets/manage/friends_tab.dart';
import 'blocked_people_screen.dart';

/// The tabs of "Edit circle", in order.
enum CircleManageTab { friends, circle }

/// "Edit circle" — the viewer's friends and their groups on two underline
/// tabs, pushed from the Settings header ("Sửa vòng kết nối", or the friend
/// count). It exists to expose the App Store 1.2 controls — report, block,
/// remove, leave — without turning the Circle into a page of red buttons:
/// each row carries one quiet `⋯`, and the negative actions live in its
/// sheet.
///
/// Titled with the viewer's own name, the way a profile's followers page is:
/// both tabs are theirs, so neither tab's name belongs in the title.
class CircleManageScreen extends ConsumerStatefulWidget {
  const CircleManageScreen({
    super.key,
    required this.parentTitle,
    this.initialTab = CircleManageTab.friends,
  });

  /// The page this was pushed from, for the back label.
  final String parentTitle;
  final CircleManageTab initialTab;

  @override
  ConsumerState<CircleManageScreen> createState() => _CircleManageScreenState();
}

class _CircleManageScreenState extends ConsumerState<CircleManageScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(
    length: CircleManageTab.values.length,
    vsync: this,
    initialIndex: widget.initialTab.index,
  );

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  void _openBlocked(String title) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => BlockedPeopleScreen(parentTitle: title),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final title =
        ref.watch(myCircleProfileProvider).valueOrNull?.label ??
        tr('groups.page.title');
    return Screen(
      bottom: false,
      child: Column(
        children: [
          InlineNavBar(title: title, parentTitle: widget.parentTitle),
          UnderlineTabBar(
            controller: _tabs,
            labels: [
              tr('groups.manage.tabFriends'),
              tr('groups.manage.tabCircle'),
            ],
          ),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                FriendsTab(onOpenBlocked: () => _openBlocked(title)),
                const CircleTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
