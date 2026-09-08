import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/feedback/sliver_centered_state.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

/// [SliverCenteredState] sizes itself from the viewport MINUS the slivers
/// before it, so its child sits at the midpoint of what is left under the
/// header — and a bottom inset is paid INSIDE the sliver, never by a spacer
/// after it (a trailing sliver would push the fill off the viewport).
void main() {
  const viewport = Size(390, 700);
  const headerExtent = 100.0;
  const bottomInset = 40.0;

  testWidgets('centres under the preceding slivers, inset paid inside', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = viewport;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: SizedBox(height: headerExtent)),
              SliverCenteredState(
                padding: EdgeInsets.only(bottom: bottomInset),
                child: SizedBox(key: Key('state'), width: 40, height: 20),
              ),
            ],
          ),
        ),
      ),
    );

    expect(
      tester.getCenter(find.byKey(const Key('state'))).dy,
      moreOrLessEquals(
        headerExtent + (viewport.height - headerExtent - bottomInset) / 2,
        epsilon: 0.5,
      ),
    );
  });

  testWidgets('a footer holds the bottom edge and the state centres above it', (
    tester,
  ) async {
    const footerHeight = 40.0;
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = viewport;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: SizedBox(height: headerExtent)),
              SliverCenteredState(
                padding: EdgeInsets.only(bottom: bottomInset),
                footer: SizedBox(
                  key: Key('footer'),
                  width: 100,
                  height: footerHeight,
                ),
                child: SizedBox(key: Key('state'), width: 40, height: 20),
              ),
            ],
          ),
        ),
      ),
    );

    // The footer is the page's bottom edge — the inset is paid under it.
    expect(
      tester.getRect(find.byKey(const Key('footer'))).bottom,
      moreOrLessEquals(viewport.height - bottomInset, epsilon: 1),
    );
    // And the state still centres — in what is left ABOVE the footer.
    expect(
      tester.getCenter(find.byKey(const Key('state'))).dy,
      moreOrLessEquals(
        (headerExtent +
                (viewport.height -
                    bottomInset -
                    footerHeight -
                    KalloSpacing.sp5)) /
            2,
        epsilon: 1,
      ),
    );
  });

  // No state at all: the page's tail, there only to hold its footer on the
  // bottom edge — the shape the nutrition content page closes on.
  testWidgets('footer-only: the footer holds the bottom edge', (tester) async {
    const footerHeight = 40.0;
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = viewport;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: SizedBox(height: headerExtent)),
              SliverCenteredState(
                padding: EdgeInsets.only(bottom: bottomInset),
                footer: SizedBox(
                  key: Key('footer'),
                  width: 100,
                  height: footerHeight,
                ),
              ),
            ],
          ),
        ),
      ),
    );

    expect(
      tester.getRect(find.byKey(const Key('footer'))).bottom,
      moreOrLessEquals(viewport.height - bottomInset, epsilon: 1),
    );
  });
}
