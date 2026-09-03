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
/// (the picker's own numbers), write it beside the original and run the same
/// [labelImageFromFile] guard on the result. Decoding a multi-megabyte photo
/// is CPU-bound, so it runs on a worker isolate via [compute].
Future<LabelImageResult> shrinkLabelImageFile(String path) async {
  try {
    final bytes = await File(path).readAsBytes();
    final shrunk = await compute(_shrinkLabelImageBytes, bytes);
    if (shrunk == null) {
      return const LabelImageResult.failure(LabelImageFailure.unsupported);
    }
    final shrunkPath = '$path.shrunk.jpg';
    await File(shrunkPath).writeAsBytes(shrunk, flush: true);
    return labelImageFromFile(shrunkPath);
  } on FileSystemException {
    return const LabelImageResult.failure(LabelImageFailure.cameraUnavailable);
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
