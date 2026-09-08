import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/features/circle/data/feed_providers.dart';

import '../../l10n_test_loader.dart';

typedef Request = ({String method, String path, Object? body});
typedef RequestHandler = FutureOr<Object?> Function(Request request);

class FakeApiClient extends ApiClient {
  FakeApiClient(this.handler);

  RequestHandler handler;
  final List<Request> requests = [];

  Future<T> _respond<T>(String method, String path, Object? body) async {
    final request = (method: method, path: path, body: body);
    requests.add(request);
    return await handler(request) as T;
  }

  @override
  Future<T> get<T>(String path) => _respond('GET', path, null);

  @override
  Future<T> post<T>(String path, [Object? body]) =>
      _respond('POST', path, body);

  @override
  Future<T> patch<T>(String path, [Object? body]) =>
      _respond('PATCH', path, body);

  @override
  Future<T> delete<T>(String path, [Object? body]) =>
      _respond('DELETE', path, body);
}

/// Pure-Dart WidgetRef adapter so mutation helpers can be exercised with a
/// ProviderContainer and no widget/l10n harness.
class ContainerWidgetRef implements WidgetRef {
  ContainerWidgetRef(this.container);

  final ProviderContainer container;

  @override
  BuildContext get context => throw UnsupportedError('No BuildContext');

  @override
  bool exists(ProviderBase<Object?> provider) => container.exists(provider);

  @override
  void invalidate(ProviderOrFamily provider) => container.invalidate(provider);

  @override
  T read<T>(ProviderListenable<T> provider) => container.read(provider);

  @override
  T refresh<T>(Refreshable<T> provider) => container.refresh(provider);

  @override
  T watch<T>(ProviderListenable<T> provider) =>
      throw UnsupportedError('watch is not used');

  @override
  void listen<T>(
    ProviderListenable<T> provider,
    void Function(T? previous, T next) listener, {
    void Function(Object error, StackTrace stackTrace)? onError,
  }) => throw UnsupportedError('listen is not used');

  @override
  ProviderSubscription<T> listenManual<T>(
    ProviderListenable<T> provider,
    void Function(T? previous, T next) listener, {
    void Function(Object error, StackTrace stackTrace)? onError,
    bool fireImmediately = false,
  }) => throw UnsupportedError('listenManual is not used');
}

Map<String, dynamic> entryJson(
  String shareId, {
  bool mine = false,
  int count = 2,
  List<Map<String, dynamic>> replies = const [],
  int? repliesTotal,
}) => {
  'friend': {
    'userId': 'friend-$shareId',
    'handle': 'friend_$shareId',
    'displayName': 'Hà',
  },
  'isSelf': false,
  'meal': {
    'mealId': 'meal-$shareId',
    'shareId': shareId,
    'rawInput': 'Bún chả Hà Nội',
    'sharedAt': '2026-07-18T03:04:05.000Z',
  },
  'reactions': {'mine': mine, 'count': count},
  'replies': replies,
  'repliesTotal': repliesTotal ?? replies.length,
};

Map<String, dynamic> replyJson(String id) => {
  'id': id,
  'author': {'userId': 'author-$id', 'handle': 'linh', 'displayName': 'Linh'},
  'isSelf': true,
  'body': 'Ngon quá!',
  'createdAt': '2026-07-18T04:05:06.000Z',
};

Map<String, dynamic> pageJson(
  List<Map<String, dynamic>> entries,
  String? cursor,
) => {'entries': entries, 'nextCursor': cursor};

Never unexpectedRequest(Request request) =>
    throw ApiError(
      'UNEXPECTED',
      400,
      false,
      '${request.method} ${request.path}',
    );

void holdProvider<T>(
  ProviderContainer container,
  ProviderListenable<T> provider,
) {
  final subscription = container.listen(provider, (_, __) {});
  addTearDown(subscription.close);
}

Future<SharedMealFeedState> mountFeed(
  ProviderContainer container,
  String? scope,
) async {
  final provider = sharedMealFeedProvider(scope);
  holdProvider(container, provider);
  return container.read(provider.future);
}

/// The two reads every Circle screen makes on the side: the friends feed
/// invalidates the read marker on every load, and the thread's composer reads
/// the viewer's own profile for its avatar. A handler that only knows the feed
/// path makes both retry and pollute the request log. Answer them and move on.
Object? readMarker(Request request) => switch (request.path) {
  '/api/v1/groups/friends/read-marker' => {
    'lastReadAt': '2026-07-18T00:00:00.000Z',
  },
  '/api/v1/groups/profile' => {
    'profile': {'userId': 'me', 'handle': 'khoa', 'displayName': 'Khoa'},
  },
  _ => unexpectedRequest(request),
};

/// Mounts [child] as a screen under the app's l10n and a [ProviderScope]
/// answering with [api], and settles it.
Future<void> pumpCircleScreen(
  WidgetTester tester,
  Widget child, {
  required FakeApiClient api,
}) async {
  await tester.pumpWidget(
    EasyLocalization(
      supportedLocales: const [Locale('en')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      assetLoader: const FsL10nLoader(),
      child: ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(api)],
        child: Builder(
          builder:
              (context) => MaterialApp(
                localizationsDelegates: context.localizationDelegates,
                supportedLocales: context.supportedLocales,
                locale: context.locale,
                home: child,
              ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

ProviderContainer makeContainer(FakeApiClient api) {
  final container = ProviderContainer(
    overrides: [apiClientProvider.overrideWithValue(api)],
  );
  addTearDown(container.dispose);
  return container;
}
