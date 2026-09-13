import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

/// Installs a golden comparator with an ABSOLUTE pixel budget.
///
/// Deliberately not a percentage. The unit of change that matters here is a
/// feature — a 12pt legend swatch is 144px whatever canvas it sits on — while a
/// percentage budget scales with the canvas, so the same real regression reads
/// as 0.51% of the legend strip and 0.12% of the whole card. A 0.5% budget was
/// measured letting the card golden pass a legend swatch that had lost its
/// gradient entirely; that is the failure mode this shape exists to prevent.
///
/// The budget only has to cover machine noise. `flutter_test` counts a pixel as
/// differing on ANY non-zero delta, so a ±1 LSB antialiasing difference on a
/// few glyph edges registers as a handful of pixels. CI pins Flutter 3.44.1 on
/// ubuntu-latest and these images are generated on the same version and OS
/// family, so the expected drift is zero; the budget is headroom, not an
/// allowance.
const int defaultGoldenPixelBudget = 32;

void useTolerantGoldens({int pixelBudget = defaultGoldenPixelBudget}) {
  final local = goldenFileComparator as LocalFileComparator;
  goldenFileComparator = _BudgetedComparator(
    Uri.parse('${local.basedir}placeholder_test.dart'),
    pixelBudget: pixelBudget,
  );
}

class _BudgetedComparator extends LocalFileComparator {
  _BudgetedComparator(super.testFile, {required this.pixelBudget});

  final int pixelBudget;

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final goldenBytes = await getGoldenBytes(golden);
    final result = await GoldenFileComparator.compareLists(
      imageBytes,
      goldenBytes,
    );
    if (result.passed) {
      result.dispose();
      return true;
    }

    // `ComparisonResult` reports a fraction, so recover the count from the
    // image's own dimensions rather than trusting a percentage.
    final image = await decodeImageFromList(Uint8List.fromList(goldenBytes));
    final total = image.width * image.height;
    image.dispose();
    final differing = (result.diffPercent * total).round();

    if (differing <= pixelBudget) {
      result.dispose();
      return true;
    }
    // Writes the isolated diff PNGs beside the golden so a failure is
    // inspectable rather than just a number.
    throw FlutterError(
      '${await generateFailureOutput(result, golden, basedir)}\n'
      '$differing px differ, budget $pixelBudget px.',
    );
  }
}

Future<ui.Image> decodeImageFromList(Uint8List bytes) async {
  final codec = await ui.instantiateImageCodec(bytes);
  final frame = await codec.getNextFrame();
  codec.dispose();
  return frame.image;
}
