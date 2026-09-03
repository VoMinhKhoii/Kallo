import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shell/nav/nav_visibility.dart';

/// The hide-on-scroll policy on its own, without a shell around it —
/// `nav_hide_on_scroll_test.dart` covers the same rule end to end.
///
/// `UserScrollNotification` demands a non-null `BuildContext`, so each case
/// pumps an empty box for one; nothing else here touches the tree.
Future<BuildContext> _context(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  return tester.element(find.byType(SizedBox));
}

UserScrollNotification _scroll(
  BuildContext context, {
  required ScrollDirection direction,
  double maxScrollExtent = 2000,
  Axis axis = Axis.vertical,
}) => UserScrollNotification(
  metrics: FixedScrollMetrics(
    minScrollExtent: 0,
    maxScrollExtent: maxScrollExtent,
    pixels: 0,
    viewportDimension: 800,
    axisDirection: axis == Axis.vertical
        ? AxisDirection.down
        : AxisDirection.right,
    devicePixelRatio: 1,
  ),
  context: context,
  direction: direction,
);

/// A notification that has crossed one viewport on its way up — an inner list
/// inside the branch, which `depth` is exactly there to distinguish. The depth
/// counter has no public setter, so it is overridden here.
class _NestedScroll extends UserScrollNotification {
  _NestedScroll({
    required super.metrics,
    required super.context,
    required super.direction,
  });

  @override
  int get depth => 1;
}

void main() {
  late ProviderContainer container;

  setUp(() {
    container = ProviderContainer();
    addTearDown(container.dispose);
  });

  NavVisibility notifier() => container.read(navVisibilityProvider.notifier);
  bool visible() => container.read(navVisibilityProvider);

  testWidgets('starts visible and lets the notification bubble', (
    tester,
  ) async {
    final context = await _context(tester);

    expect(visible(), isTrue);
    expect(
      notifier().applyScroll(
        _scroll(context, direction: ScrollDirection.reverse),
      ),
      isFalse,
    );
  });

  testWidgets('reading down a long branch hides the bar', (tester) async {
    final context = await _context(tester);

    notifier().applyScroll(_scroll(context, direction: ScrollDirection.reverse));

    expect(visible(), isFalse);
  });

  testWidgets('scrolling back up reveals it', (tester) async {
    final context = await _context(tester);
    notifier().applyScroll(_scroll(context, direction: ScrollDirection.reverse));

    notifier().applyScroll(_scroll(context, direction: ScrollDirection.forward));

    expect(visible(), isTrue);
  });

  testWidgets('idle leaves the bar wherever the drag left it', (tester) async {
    final context = await _context(tester);
    notifier().applyScroll(_scroll(context, direction: ScrollDirection.reverse));

    notifier().applyScroll(_scroll(context, direction: ScrollDirection.idle));

    expect(visible(), isFalse);
  });

  testWidgets('a page with barely any travel never hides the bar', (
    tester,
  ) async {
    final context = await _context(tester);

    notifier().applyScroll(
      _scroll(
        context,
        direction: ScrollDirection.reverse,
        maxScrollExtent: 119,
      ),
    );

    expect(visible(), isTrue);
  });

  testWidgets('a horizontal strip is not the branch scrolling', (tester) async {
    final context = await _context(tester);

    notifier().applyScroll(
      _scroll(
        context,
        direction: ScrollDirection.reverse,
        axis: Axis.horizontal,
      ),
    );

    expect(visible(), isTrue);
  });

  testWidgets('an inner scroll view (depth != 0) is ignored', (tester) async {
    final context = await _context(tester);

    notifier().applyScroll(
      _NestedScroll(
        metrics: _scroll(context, direction: ScrollDirection.reverse).metrics,
        context: context,
        direction: ScrollDirection.reverse,
      ),
    );

    expect(visible(), isTrue);
  });
}
