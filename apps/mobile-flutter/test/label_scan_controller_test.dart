import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:kallo_mobile/features/logging/data/label_scan_providers.dart';
import 'package:kallo_mobile/features/logging/logic/label/image.dart';
import 'package:kallo_mobile/features/logging/logic/label/review.dart';
import 'package:kallo_mobile/models/nutrition_label.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

/// ApiClient stand-in that records requests and replays canned responses —
/// never touches HTTP or the Supabase session. Same shape as the barcode
/// controller's fake.
class FakeApiClient extends ApiClient {
  final List<(String, String, Object?)> requests = [];
  Object? Function(String method, String path, Object? body)? handler;

  @override
  Future<T> get<T>(String path) async {
    requests.add(('GET', path, null));
    return handler!('GET', path, null) as T;
  }

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    requests.add(('POST', path, body));
    return handler!('POST', path, body) as T;
  }
}

/// A minimal valid JPEG header — enough for `detectLabelImageMime`, which is
/// the only thing that reads these bytes in a unit test.
final _jpegBytes = Uint8List.fromList([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

final _image = LabelImage(
  bytes: _jpegBytes,
  mimeType: 'image/jpeg',
  path: '/tmp/label.jpg',
);

const _labelJson = <String, dynamic>{
  'basis': 'per_100g',
  'confidence': 'high',
  'labelEvidence': 'Thông tin dinh dưỡng',
  'productName': 'Bánh quy Cosy',
  'servingSize': {'value': 30, 'unit': 'g'},
  'servingSizeDescription': '1 gói',
  'servingsPerContainer': 5,
  'per100g': {
    'calories': 480,
    'proteinGrams': 6,
    'carbsGrams': 62,
    'fatGrams': 22,
    'sodiumMg': 320,
  },
};

void main() {
  late FakeApiClient api;
  late ProviderContainer container;
  late LabelImageResult captureResult;
  late List<ImageSource> captureCalls;

  setUp(() {
    api = FakeApiClient();
    captureResult = LabelImageResult.success(_image);
    captureCalls = [];
    container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        labelImageCaptureProvider.overrideWithValue((source) async {
          captureCalls.add(source);
          return captureResult;
        }),
      ],
    );
    addTearDown(container.dispose);
    // labelScanProvider is autoDispose — hold a listener for the test's
    // lifetime so state survives between reads.
    container.listen(labelScanProvider, (_, __) {});
  });

  LabelScanController notifier() => container.read(labelScanProvider.notifier);
  LabelScanState state() => container.read(labelScanProvider);

  Future<void> reachReview() async {
    await notifier().pickImage(ImageSource.camera);
    api.handler = (_, __, ___) => <String, dynamic>{'label': _labelJson};
    await notifier().scan();
  }

  group('pickImage', () {
    test('lands on preview holding the photo', () async {
      await notifier().pickImage(ImageSource.camera);

      expect(captureCalls, [ImageSource.camera]);
      expect(state().phase, LabelScanPhase.preview);
      expect(state().image?.mimeType, 'image/jpeg');
      expect(state().errorKey, isNull);
    });

    test('a cancelled picker leaves the state untouched', () async {
      captureResult = const LabelImageResult.failure(
        LabelImageFailure.cancelled,
      );
      await notifier().pickImage(ImageSource.gallery);

      expect(state().phase, LabelScanPhase.capture);
      expect(state().image, isNull);
      expect(state().errorKey, isNull);
    });

    test('a denied permission surfaces its own copy', () async {
      captureResult = const LabelImageResult.failure(
        LabelImageFailure.permissionDenied,
      );
      await notifier().pickImage(ImageSource.camera);

      expect(state().phase, LabelScanPhase.capture);
      expect(state().errorKey, 'logging.labelScan.error.permissionDenied');
    });

    test('an oversized photo asks for another one', () async {
      captureResult = const LabelImageResult.failure(
        LabelImageFailure.tooLarge,
      );
      await notifier().pickImage(ImageSource.gallery);

      expect(state().errorKey, 'logging.labelScan.error.imageTooLarge');
    });
  });

  group('scan', () {
    test('posts the base64 photo and lands on review', () async {
      await reachReview();

      expect(state().phase, LabelScanPhase.review);
      expect(state().label?.productName, 'Bánh quy Cosy');
      expect(state().label?.basis, LabelBasis.per100g);

      final (method, path, body) = api.requests.single;
      expect(method, 'POST');
      expect(path, '/api/v1/nutrition-label/scan');
      final json = body! as Map<String, dynamic>;
      expect(json['mimeType'], 'image/jpeg');
      expect(json['imageBase64'], base64EncodeLabelImage(_image));
    });

    test('does nothing without a photo', () async {
      await notifier().scan();
      expect(api.requests, isEmpty);
      expect(state().phase, LabelScanPhase.capture);
    });

    test('keeps the photo when the scan fails, so a retry is one tap', () async {
      await notifier().pickImage(ImageSource.camera);
      api.handler = (_, __, ___) =>
          throw ApiError('OCR_NO_LABEL_DETECTED', 422, false, 'no label');

      await notifier().scan();

      expect(state().phase, LabelScanPhase.preview);
      expect(state().image, isNotNull);
      expect(state().errorKey, 'logging.labelScan.error.noLabelDetected');
      expect(state().isNoLabelDetected, isTrue);
    });

    test('maps each server code onto its own copy', () async {
      Future<String?> keyFor(ApiError error) async {
        notifier().retake();
        await notifier().pickImage(ImageSource.camera);
        api.handler = (_, __, ___) => throw error;
        await notifier().scan();
        return state().errorKey;
      }

      expect(
        await keyFor(ApiError('OCR_INVALID_IMAGE', 400, false, '')),
        'logging.labelScan.error.invalidImage',
      );
      expect(
        await keyFor(ApiError('OCR_RATE_LIMITED', 429, true, '')),
        'logging.labelScan.error.rateLimited',
      );
      // The scan route's own throttles, which pass through the OCR error mapper
      // untouched (so their Retry-After survives) and therefore reach the client
      // under the limiter's codes, not the OCR_ ones. Without their own arms
      // they fell through to the generic serverError copy.
      expect(
        await keyFor(ApiError('RATE_LIMITED', 429, true, '')),
        'logging.labelScan.error.rateLimited',
      );
      expect(
        await keyFor(ApiError('RATE_LIMITER_UNAVAILABLE', 503, true, '')),
        'logging.labelScan.error.rateLimited',
      );
      // The scan body is byte-capped now, so an oversized photo is a 413.
      expect(
        await keyFor(ApiError('PAYLOAD_TOO_LARGE', 413, false, '')),
        'logging.labelScan.error.imageTooLarge',
      );
      expect(
        await keyFor(ApiError('INTERNAL_ERROR', 500, false, '')),
        'logging.labelScan.error.serverError',
      );
    });
  });

  group('logMeal', () {
    LabelReviewState reviewFor(LabelScanState scanState) =>
        LabelReviewState(scanState.label, defaultProductName: 'Scanned food');

    test('posts the reviewed values and omits unprinted nutrients', () async {
      await reachReview();
      final review = reviewFor(state());
      review.commitAmount('50');

      api.handler = (_, __, ___) => <String, dynamic>{'mealId': 'meal-1'};
      final saved = await notifier().logMeal(
        userId: 'user-1',
        date: '2026-07-02',
        review: review,
      );

      expect(saved, isTrue);
      // Not `.last`: the day refresh that `invalidateMealSurfaces` kicks off
      // rides the same fake client and lands after the log post.
      final logRequest = api.requests.firstWhere(
        (request) => request.$2 == '/api/v1/nutrition-label/log',
      );
      final json = logRequest.$3! as Map<String, dynamic>;
      expect(json['productName'], 'Bánh quy Cosy');
      expect(json['amount'], 50);
      expect(json['unit'], 'g');
      expect(json['confidence'], 'high');
      expect(json['calories'], 240);
      expect(json['sodiumMg'], 160);
      // Never printed on this label — omitted rather than sent as null.
      expect(json.containsKey('ironMg'), isFalse);
      expect(json['mealId'], isA<String>());
      expect(json['loggedDate'], '2026-07-02');
    });

    test('refuses to post a review that cannot be confirmed', () async {
      await reachReview();
      final review = reviewFor(state())..setNutrientText('proteinGrams', '');

      final saved = await notifier().logMeal(
        userId: 'user-1',
        date: '2026-07-02',
        review: review,
      );

      expect(saved, isFalse);
      expect(api.requests.length, 1); // the scan only
    });

    test('a failed save keeps the review step and its edits', () async {
      await reachReview();
      final review = reviewFor(state());
      api.handler = (_, __, ___) =>
          throw ApiError('INTERNAL_ERROR', 500, false, 'boom');

      final saved = await notifier().logMeal(
        userId: 'user-1',
        date: '2026-07-02',
        review: review,
      );

      expect(saved, isFalse);
      expect(state().phase, LabelScanPhase.review);
      expect(state().errorKey, 'logging.labelScan.error.serverError');
    });
  });

  group('navigation', () {
    test('retake drops the photo and the scan', () async {
      await reachReview();
      notifier().retake();

      expect(state().phase, LabelScanPhase.capture);
      expect(state().image, isNull);
      expect(state().label, isNull);
    });

    test('back from review returns to the photo it came from', () async {
      await reachReview();
      notifier().backToPreview();

      expect(state().phase, LabelScanPhase.preview);
      expect(state().image, isNotNull);
      expect(state().label, isNotNull);
    });

    test('manual review opens an empty form', () async {
      notifier().enterManualReview();

      expect(state().phase, LabelScanPhase.review);
      expect(state().label, isNull);
      expect(
        LabelReviewState(state().label, defaultProductName: 'Scanned food').unit,
        'serving',
      );
    });
  });
}
