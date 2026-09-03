/// The one extra compression rung for a label still that overshot the size
/// guard, kept apart from `image.dart` so only this file pulls in the
/// pure-Dart `image` package (and the isolate hop it needs).
library;

import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/foundation.dart' show compute;
import 'package:image/image.dart' as img;

import 'image.dart';

/// The one extra rung for a still that overshot [maxLabelImageBytes]: decode,
/// downscale to [labelImageMaxWidth], re-encode as JPEG at [labelImageQuality]
/// (the picker's own numbers), run the same [labelImageFromFile] guard on the
/// result, and hand back a [LabelImage] whose bytes are the shrunk encoding
/// and whose [LabelImage.path] is still the ORIGINAL still. The shrunk copy
/// only exists on disk long enough to be guarded and read — it is deleted
/// before this returns, on success and failure alike, so no retake, replace,
/// scan failure or sheet teardown has a temp file to forget. Decoding a
/// multi-megabyte photo is CPU-bound, so it runs on a worker isolate via
/// [compute].
Future<LabelImageResult> shrinkLabelImageFile(String path) async {
  final shrunkFile = File('$path.shrunk.jpg');
  try {
    final bytes = await File(path).readAsBytes();
    final shrunk = await compute(_shrinkLabelImageBytes, bytes);
    if (shrunk == null) {
      return const LabelImageResult.failure(LabelImageFailure.unsupported);
    }
    await shrunkFile.writeAsBytes(shrunk, flush: true);
    final result = await labelImageFromFile(shrunkFile.path);
    final image = result.image;
    if (image == null) return result;
    return LabelImageResult.success(
      LabelImage(bytes: image.bytes, mimeType: image.mimeType, path: path),
    );
  } on FileSystemException {
    return const LabelImageResult.failure(LabelImageFailure.cameraUnavailable);
  } finally {
    if (await shrunkFile.exists()) await shrunkFile.delete();
  }
}

Uint8List? _shrinkLabelImageBytes(Uint8List bytes) {
  final decoded = img.decodeImage(bytes);
  if (decoded == null) return null;
  final resized = decoded.width > labelImageMaxWidth
      ? img.copyResize(decoded, width: labelImageMaxWidth.toInt())
      : decoded;
  return Uint8List.fromList(img.encodeJpg(resized, quality: labelImageQuality));
}
