import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/feedback/sliver_centered_state.dart';

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
}
