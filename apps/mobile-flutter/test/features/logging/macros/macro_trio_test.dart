import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/macros/macro_trio.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

/// The width a meal row actually gets inside the card on a 390pt phone: the
/// feed's gutter plus the card's own padding. Every claim below is about that
/// width — on the default 800pt test surface nothing here would ever clip.
const double _rowWidth = 334;

/// How many lines the card gives a dish name. A test knob only so the
/// "second line" claim can be shown to fail at one line.
int _nameLines = 2;

/// One meal row, laid out the way the persisted card lays it out.
Widget _row(
  String name,
  double p,
  double c,
  double f,
  double kcal, {
  double textScale = 1.0,
}) => MediaQuery(
  data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
  child: Directionality(
    textDirection: TextDirection.ltr,
    child: Center(
      child: SizedBox(
        width: _rowWidth,
        child: Row(
          children: [
            Expanded(
              child: Text(
                name,
                maxLines: _nameLines,
                overflow: TextOverflow.ellipsis,
                style: dashBody(),
              ),
            ),
            const SizedBox(width: KalloSpacing.sp3),
            MacroTrio(protein: p, carbs: c, fat: f, calories: kcal),
          ],
        ),
      ),
    ),
  ),
);

/// The card's bottom line at the width it really gets.
const Widget _totalsRow = Directionality(
  textDirection: TextDirection.ltr,
  child: Center(
    child: SizedBox(
      width: _rowWidth,
      child: MealTotalsRow(
        label: 'Total',
        protein: 67,
        carbs: 59,
        fat: 32,
        calories: 1794,
      ),
    ),
  ),
);

/// How much a FittedBox took [finder] in: its PAINTED width (global, so
/// ancestor transforms apply) over the width it laid itself out at. 1.0 means
/// nothing scaled it; below 1.0 means it was shrunk to fit rather than clipped.
double _paintedScale(WidgetTester tester, Finder finder) =>
    tester.getRect(finder).width / tester.getSize(finder).width;

void main() {
  setUpAll(() async {
    // Measure against the real typeface. With the test font (every glyph one em
    // wide) these widths are fiction, and the whole point here is real widths.
    final loader = FontLoader('BeVietnamPro')..addFont(
      File(
        'assets/google_fonts/BeVietnamPro-Regular.ttf',
      ).readAsBytes().then(ByteData.sublistView),
    );
    await loader.load();
  });

  testWidgets('keeps the unit on a three-digit kcal figure', (tester) async {
    // The reported bug: `240 kcal` measures 60.4 against a 62pt column, so it
    // fit by 1.6pt at scale 1.0 and lost ` kcal` the moment anything nudged it.
    // A bare `240` beside a neighbouring `31 kcal` reads as a different unit,
    // not as truncation.
    await tester.pumpWidget(_row('Cơm trắng', 5, 54, 0, 240));
    expect(find.text('240 kcal'), findsOneWidget);
    expect(
      _paintedScale(tester, find.text('240 kcal')),
      moreOrLessEquals(1.0, epsilon: 0.02),
    );
  });

  testWidgets('a three-digit macro renders at full size', (tester) async {
    // Reported from a device: "every number that reaches 3 digits gets
    // smaller". The cell was 40 against `C: 105g`'s 41.1, so a carb figure
    // crossing 100g shrank to 0.96 while its two-digit neighbours in the same
    // row stayed put — and the totals line, which is where three digits
    // actually happen, read smaller than the rows it sums.
    await tester.pumpWidget(_row('Cơm gà', 51, 105, 16, 776));
    for (final value in ['51g', '105g', '16g']) {
      expect(
        _paintedScale(tester, find.text(value)),
        moreOrLessEquals(1.0, epsilon: 0.005),
        reason: '$value was taken in',
      );
    }
  });

  testWidgets('labels and figures each form a column, tight together', (
    tester,
  ) async {
    // Two failed shapes preceded this one, both reported from a device:
    //   1. label pinned left, value pinned right — the gap between them
    //      changed with the digit count, so `P: 0g` yawned open beside
    //      `P:49g` on the next row;
    //   2. figures right-aligned in a field of their own — the figures lined
    //      up, but a one-digit value sat 17pt from its own label.
    // Both runs are pinned LEFT now: two columns, a label-width apart.
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: Center(
          child: SizedBox(
            width: _rowWidth,
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(child: Text('x')),
                    SizedBox(width: KalloSpacing.sp3),
                    MacroTrio(protein: 0, carbs: 16, fat: 5, calories: 113),
                  ],
                ),
                Row(
                  children: [
                    Expanded(child: Text('y')),
                    SizedBox(width: KalloSpacing.sp3),
                    MacroTrio(protein: 49, carbs: 105, fat: 9, calories: 526),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );

    // Protein `0g` and `49g`, carbs `16g` and `105g`, fat `5g` and `9g` — a
    // one-digit figure and a two- or three-digit one in the same column. Their
    // LEFT edges match, so the numbers read down the card whatever their
    // length; only the `g` after them moves.
    for (final pair in [('0g', '49g'), ('16g', '105g'), ('5g', '9g')]) {
      expect(
        tester.getTopLeft(find.text(pair.$1)).dx,
        moreOrLessEquals(
          tester.getTopLeft(find.text(pair.$2)).dx,
          epsilon: 0.5,
        ),
        reason: '${pair.$1} and ${pair.$2} do not start at the same x',
      );
    }

    // And a label is never more than its own box's slack from its figure — no
    // hole between `P:` and the number it belongs to.
    final labelRight = tester.getTopRight(find.text('P:').first).dx;
    final figureLeft = tester.getTopLeft(find.text('0g')).dx;
    expect(figureLeft - labelRight, lessThan(4));
  });

  testWidgets('keeps it at the app\'s largest text scale too', (tester) async {
    // `app.dart` clamps scaling at 1.3, where `240 kcal` grows to 78.5 against
    // a 74pt column. It is taken in a little — NOT clipped, which is the
    // guarantee that matters and the one the reported bug broke.
    //
    // The column used to be 80, which absorbed 1.3x outright. It was narrowed
    // deliberately: its width is what sets where the P/C/F block stops, and at
    // 80 the macros sat a visible hole away from the calories on every row. A
    // 4% reduction at the largest accessibility scale is the price.
    await tester.pumpWidget(_row('Cơm trắng', 5, 54, 0, 240, textScale: 1.3));
    expect(find.text('240 kcal'), findsOneWidget);
    final scale = _paintedScale(tester, find.text('240 kcal'));
    expect(scale, greaterThan(0.9), reason: 'taken in further than intended');
    expect(scale, lessThanOrEqualTo(1.0));
  });

  testWidgets('a four-digit row shrinks rather than losing its unit', (
    tester,
  ) async {
    // Past what the column can absorb, the value is taken in — never clipped.
    // A clipped `1794 kcal` renders as `1794`, which reads as a different unit.
    await tester.pumpWidget(_row('Cơm trắng', 5, 54, 0, 1794, textScale: 1.3));
    expect(find.text('1794 kcal'), findsOneWidget);
    final scale = _paintedScale(tester, find.text('1794 kcal'));
    expect(scale, lessThan(1.0), reason: 'it had to be taken in');
    expect(
      scale,
      greaterThan(0.7),
      reason: 'but not to the point of illegible',
    );
  });

  testWidgets('every row in a card lands its columns at the same x', (
    tester,
  ) async {
    // The fixed cells exist for this. A value that ellipsizes in one row and
    // not the next is what made the card read as ragged.
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: Center(
            child: SizedBox(
              width: _rowWidth,
              child: Column(
                children: [
                  for (final r in const [
                    (3.0, 4.0, 0.0, 31.0),
                    (5.0, 54.0, 0.0, 240.0),
                    (37.0, 0.0, 14.0, 268.0),
                  ])
                    Row(
                      children: [
                        const Expanded(child: Text('x')),
                        const SizedBox(width: KalloSpacing.sp3),
                        MacroTrio(
                          protein: r.$1,
                          carbs: r.$2,
                          fat: r.$3,
                          calories: r.$4,
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    for (final label in ['P:', 'C:', 'F:']) {
      final xs =
          tester
              .widgetList<Text>(find.text(label))
              .toList()
              .asMap()
              .keys
              .map((i) => tester.getTopLeft(find.text(label).at(i)).dx)
              .toSet();
      expect(xs, hasLength(1), reason: '$label drifted between rows: $xs');
    }
    // And the kcal figures all end on the same right edge.
    final rights =
        ['31 kcal', '240 kcal', '268 kcal']
            .map((t) => tester.getTopRight(find.text(t)).dx.roundToDouble())
            .toSet();
    expect(rights, hasLength(1), reason: 'ragged kcal edge: $rights');
  });

  testWidgets('a long dish name gets a second line before it gives up', (
    tester,
  ) async {
    // "Top blade áp chảo" needs 128pt; the name column is ~96. On one line it
    // ellipsized to "Top blade á…", losing the words that identify the dish.
    await tester.pumpWidget(_row('Top blade áp chảo', 37, 0, 14, 268));
    final width = tester.getSize(find.text('Top blade áp chảo')).width;
    final painter = TextPainter(
      text: TextSpan(
        text: 'Top blade áp chảo',
        style: tester.widget<Text>(find.text('Top blade áp chảo')).style,
      ),
      textDirection: TextDirection.ltr,
      maxLines: _nameLines,
    )..layout(maxWidth: width);
    expect(
      painter.didExceedMaxLines,
      isFalse,
      reason: 'the whole name must fit within the lines it is allowed',
    );

    // And it genuinely needed the second one — at one line this same name is
    // the "Top blade á…" from the report.
    final oneLine = TextPainter(
      text: TextSpan(
        text: 'Top blade áp chảo',
        style: tester.widget<Text>(find.text('Top blade áp chảo')).style,
      ),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout(maxWidth: width);
    expect(oneLine.didExceedMaxLines, isTrue);
  });

  testWidgets('no row overflows its width at any allowed text scale', (
    tester,
  ) async {
    for (final scale in [1.0, 1.15, 1.3]) {
      await tester.pumpWidget(
        _row('Top blade áp chảo', 37, 999, 14, 1234, textScale: scale),
      );
      expect(
        tester.takeException(),
        isNull,
        reason: 'overflowed at text scale $scale',
      );
    }
  });

  testWidgets('the totals line survives the largest text scale', (
    tester,
  ) async {
    // Same card, same failure mode: an unbounded macro string beside an
    // unbounded kcal figure, inside a row with nowhere to give.
    const totals = _totalsRow;
    for (final scale in [1.0, 1.3]) {
      await tester.pumpWidget(
        MediaQuery(
          data: MediaQueryData(textScaler: TextScaler.linear(scale)),
          child: totals,
        ),
      );
      expect(
        tester.takeException(),
        isNull,
        reason: 'totals overflowed at text scale $scale',
      );
      expect(find.text('1794 kcal'), findsOneWidget);
    }
  });

  testWidgets('the totals line shares the item rows\' columns', (tester) async {
    // The point of the change: `Total` is the sum of the rows above it, so its
    // P/C/F must sit in the same columns. It used to be one interpolated run,
    // which landed wherever its own width put it.
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: Center(
          child: SizedBox(
            width: _rowWidth,
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(child: Text('Cơm gà')),
                    SizedBox(width: KalloSpacing.sp3),
                    MacroTrio(protein: 49, carbs: 61, fat: 9, calories: 526),
                  ],
                ),
                MealTotalsRow(
                  label: 'Total',
                  protein: 51,
                  carbs: 105,
                  fat: 16,
                  calories: 776,
                ),
              ],
            ),
          ),
        ),
      ),
    );

    for (final label in ['P:', 'C:', 'F:']) {
      final xs =
          [
            0,
            1,
          ].map((i) => tester.getTopLeft(find.text(label).at(i)).dx).toSet();
      expect(
        xs,
        hasLength(1),
        reason: '$label sits at a different x on the totals line: $xs',
      );
    }
    // And both kcal figures end on the same right edge, despite the total
    // being set two sizes larger.
    expect({
      tester.getTopRight(find.text('526 kcal')).dx.roundToDouble(),
      tester.getTopRight(find.text('776 kcal')).dx.roundToDouble(),
    }, hasLength(1));
  });
}
