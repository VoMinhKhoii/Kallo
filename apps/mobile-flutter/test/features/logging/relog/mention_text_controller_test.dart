import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/features/logging/logic/relog/mentions.dart';
import 'package:nham_mobile/features/logging/widgets/relog/mention_text_controller.dart';
import 'package:nham_mobile/models/relog.dart';
import 'package:nham_mobile/theme/nham_colors.dart';

RelogDishCandidate _dish(String name, {int order = 0}) => RelogDishCandidate(
  sourceMealId: 'meal-1',
  name: name,
  occurrenceCount: 2,
  lastLoggedAt: '2026-07-01T00:00:00.000Z',
  summary: const RelogMacroSummary(caloriesKcal: 410, proteinG: 20),
  mealItemOrder: order,
  ingredientCount: 3,
);

/// Type [value] into the controller and let it re-locate its mentions, the way
/// the composer's onChanged does.
void _type(MentionTextEditingController c, String value) {
  c.value = TextEditingValue(
    text: value,
    selection: TextSelection.collapsed(offset: value.length),
  );
  c.syncMentions();
}

/// WCAG contrast ratio of [color] against white.
double _contrastOnWhite(Color color) {
  double channel(double c) =>
      c <= 0.03928 ? c / 12.92 : math.pow((c + 0.055) / 1.055, 2.4).toDouble();
  final luminance =
      0.2126 * channel(color.r) +
      0.7152 * channel(color.g) +
      0.0722 * channel(color.b);
  return 1.05 / (luminance + 0.05);
}

/// Pick a candidate at whatever `/` token is currently open.
bool _pick(
  MentionTextEditingController c,
  RelogCandidate candidate,
  String stageId,
) {
  final token = c.activeToken;
  expect(token, isNotNull, reason: 'no `/` token open to pick into');
  return c.addMention(candidate, token!, stageId);
}

void main() {
  late MentionTextEditingController c;

  setUp(() => c = MentionTextEditingController());
  tearDown(() => c.dispose());

  group('picking', () {
    test('writes the label into the text and stages the reference', () {
      _type(c, '/pho');
      expect(_pick(c, _dish('Phở bò'), 'a'), isTrue);

      // The pick KEEPS the slash it was summoned with — that is the whole
      // treatment now, plus the colour.
      expect(c.text, '/Phở bò ');
      expect(c.entries.single.label, '/Phở bò');
      expect(
        c.entries.single.ref,
        const RelogDishRef(sourceMealId: 'meal-1', mealItemOrder: 0),
      );
    });

    test('keeps the text the user typed around the token', () {
      _type(c, 'sáng /pho rồi');
      // Caret sits after "/pho", not at the end.
      c.selection = const TextSelection.collapsed(offset: 9);
      final token = c.activeToken!;
      c.addMention(_dish('Phở bò'), token, 'a');

      expect(c.text, 'sáng /Phở bò rồi');
    });

    test('the caret lands after the inserted label, ready to keep typing', () {
      _type(c, '/pho');
      _pick(c, _dish('Phở bò'), 'a');
      expect(c.selection.baseOffset, '/Phở bò '.length);
    });

    test('duplicate picks of the same dish stay distinct', () {
      _type(c, '/ca');
      _pick(c, _dish('Cà phê'), 'a');
      _type(c, '${c.text}/ca');
      _pick(c, _dish('Cà phê'), 'b');

      expect(c.entries.length, 2);
      expect(c.entries.map((e) => e.stageId), ['a', 'b']);

      // Deleting ONE copy's text drops exactly one reference: two coffees is a
      // real meal, so the second must survive its twin being removed.
      _type(c, '/Cà phê ');
      expect(c.entries.length, 1);
    });

    test(
      'refuses a pick past the staged cap rather than dropping it silently',
      () {
        for (var i = 0; i < kRelogMaxStaged; i++) {
          _type(c, '${c.text}/x');
          expect(_pick(c, _dish('Dish $i', order: i), 'stage-$i'), isTrue);
        }
        _type(c, '${c.text}/x');
        expect(_pick(c, _dish('One too many', order: 99), 'over'), isFalse);
        expect(c.entries.length, kRelogMaxStaged);
      },
    );
  });

  group('editing', () {
    test('drops a mention whose label the user broke', () {
      _type(c, '/pho');
      _pick(c, _dish('Phở bò'), 'a');
      _type(c, '/Phở gà ');

      expect(
        c.entries,
        isEmpty,
        reason: 'a half-deleted name must not still log a dish',
      );
    });

    test('survives text inserted before it', () {
      _type(c, '/pho');
      _pick(c, _dish('Phở bò'), 'a');
      _type(c, 'sáng nay /Phở bò ');

      expect(c.entries.single.label, '/Phở bò');
      expect(c.mentions.single.start, 9);
    });

    test('freeText is what the user typed AROUND the picks', () {
      _type(c, '/pho');
      _pick(c, _dish('Phở bò'), 'a');
      _type(c, '${c.text}và 2 quả trứng');

      expect(c.freeText, 'và 2 quả trứng');
    });

    test('freeText is empty for a pure relog', () {
      _type(c, '/pho');
      _pick(c, _dish('Phở bò'), 'a');
      expect(c.freeText, isEmpty);
    });
  });

  group('consume, clear and snapshot', () {
    test('consumeMentions strips the picks but keeps free text', () {
      _type(c, '/pho');
      _pick(c, _dish('Phở bò'), 'a');
      _type(c, '${c.text}và trứng');

      c.consumeMentions();
      expect(c.text, 'và trứng');
      expect(c.entries, isEmpty);
    });

    test('clear drops the picks with the text', () {
      _type(c, '/pho');
      _pick(c, _dish('Phở bò'), 'a');
      c.clear();
      expect(c.entries, isEmpty);
      expect(c.text, isEmpty);
    });

    test('a snapshot restores text AND picks after a cleared submit', () {
      _type(c, '/pho');
      _pick(c, _dish('Phở bò'), 'a');
      _type(c, '${c.text}và trứng');
      final snap = c.snapshot();

      // What a combined submit does: clear to show the streaming card.
      c.clear();
      expect(c.entries, isEmpty);

      c.restore(snap);
      expect(c.text, '/Phở bò và trứng');
      expect(
        c.entries.single.ref,
        const RelogDishRef(sourceMealId: 'meal-1', mealItemOrder: 0),
        reason: 'the pick must come back for the retry, not just its text',
      );
    });

    test('restore re-locates rather than trusting the snapshot offsets', () {
      _type(c, '/pho');
      _pick(c, _dish('Phở bò'), 'a');
      final snap = c.snapshot();
      c.clear();

      // A snapshot whose label is no longer present must not resurrect a
      // reference pointing at text that isn't there.
      c.restore(MentionSnapshot(text: 'chỉ là chữ', mentions: snap.mentions));
      expect(c.entries, isEmpty);
    });
  });

  group('tinting', () {
    testWidgets(
      'paints mention runs in the mention colour, prose in the base',
      (tester) async {
        _type(c, '/pho');
        _pick(c, _dish('Phở bò'), 'a');
        _type(c, '${c.text}và trứng');

        late TextSpan span;
        await tester.pumpWidget(
          Builder(
            builder: (context) {
              span = c.buildTextSpan(
                context: context,
                style: const TextStyle(color: NhamColors.text),
                withComposing: false,
              );
              return const SizedBox();
            },
          ),
        );

        final children = span.children!.cast<TextSpan>();
        expect(
          children.map((s) => s.text).join(),
          c.text,
          reason: 'the painted spans must reproduce the value exactly',
        );

        // Blue ink and NOTHING else — no band, no fill. The slash is inside the
        // tinted run, so the whole token reads as one reference.
        final tinted = children.where(
          (s) => s.style?.color == NhamColors.mention,
        );
        expect(tinted.map((s) => s.text), ['/Phở bò']);
        for (final segment in tinted) {
          expect(
            segment.style?.backgroundColor,
            isNull,
            reason: 'a pick is tinted text, not a chip',
          );
        }

        // Everything around it keeps the field's ordinary ink.
        final plain = children.where((s) => s.text != '/Phở bò');
        expect(plain, isNotEmpty);
        for (final segment in plain) {
          expect(segment.style?.color, isNot(NhamColors.mention));
          expect(segment.style?.backgroundColor, isNull);
        }
      },
    );

    test('the mention blue clears AA on the composer\'s white field', () {
      // The web's --nham-mention (#4A90D9) measures 3.34:1 on white — under AA
      // for 14px body text. This one is picked to clear 4.5:1; if someone
      // syncs it back to the web value, this fails.
      expect(_contrastOnWhite(NhamColors.mention), greaterThanOrEqualTo(4.5));
    });

    testWidgets('leaves plain prose to the default span', (tester) async {
      _type(c, 'phở bò một tô');

      late TextSpan span;
      await tester.pumpWidget(
        Builder(
          builder: (context) {
            span = c.buildTextSpan(
              context: context,
              style: const TextStyle(color: NhamColors.text),
              withComposing: false,
            );
            return const SizedBox();
          },
        ),
      );
      expect(span.toPlainText(), 'phở bò một tô');
    });
  });
}
