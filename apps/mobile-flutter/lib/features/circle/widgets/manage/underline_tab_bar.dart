import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';

/// Equal-width text tabs over a hairline, the selected one ink with a 2pt ink
/// rule under it — the Instagram "followers / following" switcher, which the
/// user asked to try here in place of the app's pill strip (2026-09-28).
///
/// **Why Material's [TabBar].** Cupertino ships no underline tab bar:
/// `CupertinoSlidingSegmentedControl` is a thumb in a track, which is exactly
/// the chip look this replaces, and `CupertinoTabBar` is a bottom icon bar.
/// [TabBar] with a [TabController] also gives the paging this needs for free:
/// the rule follows a swipe of the [TabBarView] under it frame by frame.
/// Material's tells are switched off — no ink splash, no hover or press
/// overlay — so the only motion is the rule sliding.
///
/// Experimental and feature-local on purpose: it has one consumer, the "Edit
/// circle" page. Promote it to `shared/widgets/` when a second surface adopts
/// it, and retire `SegmentedStrip` there only if the user settles on this
/// style app-wide.
class UnderlineTabBar extends StatelessWidget implements PreferredSizeWidget {
  const UnderlineTabBar({
    super.key,
    required this.labels,
    required this.controller,
  });

  final List<String> labels;
  final TabController controller;

  /// 44pt: the app's hit target, and a 16pt label with room to breathe.
  static const double height = 44;

  @override
  Size get preferredSize => const Size.fromHeight(height);

  @override
  Widget build(BuildContext context) {
    return TabBar(
      controller: controller,
      tabs: [
        for (final label in labels)
          Tab(
            height: height,
            child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
          ),
      ],
      // Selected vs not is ink vs muted at one weight — the app's rule that
      // emphasis is colour, not weight (`kallo-design/mobile.md`, *Type scale*).
      labelStyle: dashBody(),
      unselectedLabelStyle: dashBody(),
      labelColor: kInk,
      unselectedLabelColor: kInkMuted,
      indicator: const UnderlineTabIndicator(
        borderSide: BorderSide(color: kInk, width: 2),
      ),
      indicatorSize: TabBarIndicatorSize.tab,
      dividerColor: kHairline,
      dividerHeight: 1,
      splashFactory: NoSplash.splashFactory,
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      labelPadding: EdgeInsets.zero,
    );
  }
}
