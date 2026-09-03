import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/models/social/circle.dart';
import 'package:kallo_mobile/shared/widgets/avatar/profile_avatar.dart';

/// The disc draws the person's photo through [CachedNetworkImage] — a disk
/// cache plus a decode downscaled to the disc's device pixels — and falls
/// back to the initials whenever there is no usable URL.
///
/// Every assertion here reads the WIDGET TREE. Nothing waits on a network
/// image: under `flutter test` the HTTP client is stubbed to 400s, so
/// `pumpAndSettle` on a real fetch is a test that hangs or lies.
CircleProfile _profile({String? avatarUrl}) => CircleProfile(
  userId: 'u1',
  handle: 'ana',
  displayName: 'Ana',
  avatarUrl: avatarUrl,
);

Widget _host(CircleProfile profile, double size, double dpr) => MediaQuery(
  data: MediaQueryData(devicePixelRatio: dpr),
  child: Directionality(
    textDirection: TextDirection.ltr,
    child: Center(child: ProfileAvatarDisc(profile: profile, size: size)),
  ),
);

void main() {
  testWidgets('a null avatarUrl renders the initials disc only', (
    tester,
  ) async {
    await tester.pumpWidget(_host(_profile(), 36, 3));

    expect(find.byType(CachedNetworkImage), findsNothing);
    expect(find.text('A'), findsOneWidget);
  });

  testWidgets('a blank avatarUrl renders the initials disc only', (
    tester,
  ) async {
    // The API returns '' for a cleared avatar, not null — a bare
    // `Image.network('')` would throw on a URL that is merely empty.
    await tester.pumpWidget(_host(_profile(avatarUrl: '   '), 36, 3));

    expect(find.byType(CachedNetworkImage), findsNothing);
    expect(find.text('A'), findsOneWidget);
  });

  testWidgets('a photo decodes at the disc size, not the source size', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(_profile(avatarUrl: 'https://cdn.test/ana.jpg'), 36, 3),
    );

    final image = tester.widget<CachedNetworkImage>(
      find.byType(CachedNetworkImage),
    );
    expect(image.imageUrl, 'https://cdn.test/ana.jpg');
    // 36pt at dpr 3 = 108 real pixels. Before this the full upload (often
    // 1024px+) was decoded whole for a 24–36pt disc, on every cold start.
    expect(image.memCacheWidth, 108);
  });

  testWidgets('memCacheWidth follows the device pixel ratio', (tester) async {
    await tester.pumpWidget(
      _host(_profile(avatarUrl: 'https://cdn.test/ana.jpg'), 24, 2),
    );

    expect(
      tester
          .widget<CachedNetworkImage>(find.byType(CachedNetworkImage))
          .memCacheWidth,
      48,
    );
  });
}
