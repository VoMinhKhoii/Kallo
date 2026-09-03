import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:kallo_mobile/features/logging/data/label_scan_providers.dart';
import 'package:kallo_mobile/features/logging/logic/label/image.dart';
import 'package:kallo_mobile/features/logging/logic/label/image_shrink.dart';
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

  /// The in-sheet live camera writes a still to disk and hands over the path;
  /// the picker path now ends in the same function. These cover it directly
  /// with real temp files — the size guard, the magic-byte sniff, and success.
  group('labelImageFromFile', () {
    late Directory dir;

    setUp(() async {
      dir = await Directory.systemTemp.createTemp('kallo_label_');
      addTearDown(() => dir.delete(recursive: true));
    });

    Future<String> write(String name, List<int> bytes) async {
      final file = File('${dir.path}/$name');
      await file.writeAsBytes(bytes);
      return file.path;
    }

    test('a JPEG comes back with bytes, mime and its path', () async {
      final path = await write('label.jpg', _jpegBytes);

      final result = await labelImageFromFile(path);

      expect(result.failure, isNull);
      expect(result.image!.mimeType, 'image/jpeg');
      expect(result.image!.bytes, _jpegBytes);
      expect(result.image!.path, path);
    });

    test('a PNG is recognised from its magic bytes, not its extension', () async {
      final path = await write('label.jpg', [
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
      ]);

      final result = await labelImageFromFile(path);

      expect(result.image!.mimeType, 'image/png');
    });

    test('anything that is not JPEG/PNG/WebP is unsupported', () async {
      final path = await write('label.jpg', List<int>.filled(64, 0x41));

      final result = await labelImageFromFile(path);

      expect(result.image, isNull);
      expect(result.failure, LabelImageFailure.unsupported);
    });

    test('over the payload cap is rejected without buffering it', () async {
      final path = await write(
        'huge.jpg',
        List<int>.filled(maxLabelImageBytes + 1, 0xff),
      );

      final result = await labelImageFromFile(path);

      expect(result.failure, LabelImageFailure.tooLarge);
    });

    test('an empty file is rejected too', () async {
      final path = await write('empty.jpg', const <int>[]);

      expect((await labelImageFromFile(path)).failure,
          LabelImageFailure.tooLarge);
    });

    test('a file that vanished reports the camera, not a bad image', () async {
      final result = await labelImageFromFile('${dir.path}/never_written.jpg');

      expect(result.failure, LabelImageFailure.cameraUnavailable);
    });
  });

  /// The controller side of the live camera: it holds the still for review the
  /// same way the picker path does, and a camera failure lands on the capture
  /// phase with an error the branch renders as its ScanErrorCard.
  group('captureFromFile', () {
    late Directory dir;

    setUp(() async {
      dir = await Directory.systemTemp.createTemp('kallo_label_ctrl_');
      addTearDown(() => dir.delete(recursive: true));
    });

    test('a good still lands on preview, ready to scan', () async {
      final file = File('${dir.path}/shot.jpg');
      await file.writeAsBytes(_jpegBytes);

      await notifier().captureFromFile(file.path);

      expect(state().phase, LabelScanPhase.preview);
      expect(state().image!.mimeType, 'image/jpeg');
      expect(state().errorKey, isNull);
    });

    test('a refused camera lands on capture with the permission copy', () {
      notifier().reportCaptureFailure(LabelImageFailure.permissionDenied);

      expect(state().phase, LabelScanPhase.capture);
      expect(state().image, isNull);
      expect(state().errorKey, 'logging.labelScan.error.permissionDenied');
    });

    test('a camera that would not open is a retry, not a settings trip', () {
      notifier().reportCaptureFailure(LabelImageFailure.cameraUnavailable);

      expect(state().errorKey, 'logging.labelScan.error.serverError');
    });
  });

  // A live-camera still is handed over at whatever size the sensor produced,
  // and `ResolutionPreset.veryHigh` is a target, not a byte guarantee. A still
  // over the 4 MiB guard must be shrunk to the picker's rung, not dropped.
  group('shrinkLabelImageFile', () {
    late Directory dir;

    setUp(() async {
      dir = await Directory.systemTemp.createTemp('kallo_label_big_');
      addTearDown(() => dir.delete(recursive: true));
    });

    test('an oversized still comes back under the guard at 1600px', () async {
      // Noise does not compress: 2400² at q100 is comfortably past 4 MiB.
      final noisy = img.Image(width: 2400, height: 2400);
      var seed = 7;
      for (final px in noisy) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        px.setRgb(seed & 0xff, (seed >> 8) & 0xff, (seed >> 16) & 0xff);
      }
      final big = img.encodeJpg(noisy, quality: 100);
      expect(big.length, greaterThan(maxLabelImageBytes));
      final path = '${dir.path}/big.jpg';
      await File(path).writeAsBytes(big);
      expect(
        (await labelImageFromFile(path)).failure,
        LabelImageFailure.tooLarge,
      );

      final result = await shrinkLabelImageFile(path);

      expect(result.failure, isNull);
      final image = result.image!;
      expect(image.mimeType, 'image/jpeg');
      expect(image.bytes.length, lessThanOrEqualTo(maxLabelImageBytes));
      expect(img.decodeJpg(image.bytes)!.width, labelImageMaxWidth.toInt());
      // The shrunk copy is a means to the bytes, not a file anyone owns:
      // the result points at the original still and the temp is gone.
      expect(image.path, path);
      expect(File('$path.shrunk.jpg').existsSync(), isFalse);
    });

    test('a file that is not an image is unsupported', () async {
      final path = '${dir.path}/junk.jpg';
      await File(path).writeAsBytes(List<int>.filled(64, 0x41));
      expect(
        (await shrinkLabelImageFile(path)).failure,
        LabelImageFailure.unsupported,
      );
      expect(File('$path.shrunk.jpg').existsSync(), isFalse);
    });
  });
}
