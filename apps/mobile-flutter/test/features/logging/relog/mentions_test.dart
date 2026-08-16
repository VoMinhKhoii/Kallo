import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/relog/mentions.dart';
import 'package:kallo_mobile/features/logging/logic/relog/slash_token.dart';
import 'package:kallo_mobile/models/relog.dart';

RelogMention _mention(String label, int start, {String? stageId}) =>
    RelogMention(
      stageId: stageId ?? 'stage-$label-$start',
      ref: const RelogMealRef(sourceMealId: 'meal-1'),
      label: label,
      start: start,
    );

void main() {
  group('insertMention', () {
    test('replaces the token with the label and trails a space', () {
      final result = insertMention(
        '/pho',
        const SlashToken(start: 0, end: 4, query: 'pho'),
        'Phở bò',
      );
      expect(result.value, 'Phở bò ');
      expect(result.caret, 7);
      expect(result.start, 0);
    });

    test('keeps the text around the token', () {
      final result = insertMention(
        'sáng /pho rồi',
        const SlashToken(start: 5, end: 9, query: 'pho'),
        'Phở bò',
      );
      expect(result.value, 'sáng Phở bò rồi');
      expect(result.start, 5);
    });

    test('does not double the separator when a space already follows', () {
      final result = insertMention(
        '/pho ',
        const SlashToken(start: 0, end: 4, query: 'pho'),
        'Phở bò',
      );
      expect(result.value, 'Phở bò ');
    });
  });

  group('reconcileMentions', () {
    test('keeps a mention whose text is untouched', () {
      final out = reconcileMentions('Phở bò ', [_mention('Phở bò', 0)]);
      expect(out.length, 1);
      expect(out.single.start, 0);
    });

    test('re-locates a mention after text is inserted before it', () {
      final out = reconcileMentions('sáng Phở bò', [_mention('Phở bò', 0)]);
      expect(out.single.start, 5);
    });

    test('drops a mention whose label was edited', () {
      final out = reconcileMentions('Phở gà', [_mention('Phở bò', 0)]);
      expect(out, isEmpty);
    });

    test('drops a mention whose text was removed entirely', () {
      expect(reconcileMentions('', [_mention('Phở bò', 0)]), isEmpty);
    });

    test('keeps duplicate picks distinct rather than collapsing them', () {
      final out = reconcileMentions('Cà phê Cà phê ', [
        _mention('Cà phê', 0, stageId: 'a'),
        _mention('Cà phê', 7, stageId: 'b'),
      ]);
      expect(out.map((m) => m.start), [0, 7]);
      expect(out.map((m) => m.stageId), ['a', 'b']);
    });

    test('drops only the deleted one of two identical mentions', () {
      final out = reconcileMentions('Cà phê ', [
        _mention('Cà phê', 0, stageId: 'a'),
        _mention('Cà phê', 7, stageId: 'b'),
      ]);
      expect(out.length, 1);
      expect(out.single.stageId, 'a');
    });

    test('drops a mention a reflow moved behind the scan cursor', () {
      final out = reconcileMentions('Bún chả và Phở bò', [
        _mention('Phở bò', 0),
        _mention('Bún chả', 20),
      ]);
      // 'Phở bò' is claimed at 11; the cursor has passed 'Bún chả' by then, so
      // the second mention finds no occurrence at or after it and is dropped.
      // The offsets here are STALE, not merely unordered — sorting by a start
      // that no longer describes the text cannot rescue them.
      expect(out.map((m) => m.label), ['Phở bò']);
    });

    // The cursor only moves forward, so a caller that hands over a pick made
    // EARLIER in the sentence than one already staged would have it walked past
    // and dropped — the reference gone while its label sits in the text, headed
    // for the AI as prose. Sorting inside the walk is what makes callers safe.
    test('keeps a mention the caller listed out of composer order', () {
      final out = reconcileMentions('Cà phê Phở bò', [
        _mention('Phở bò', 7),
        _mention('Cà phê', 0),
      ]);
      expect(out.map((m) => m.label), ['Cà phê', 'Phở bò']);
      expect(out.map((m) => m.start), [0, 7]);
    });

    // A pick spliced in exactly where another one started: the splice is what
    // pushed the old one right, so the newcomer — listed first — takes the slot.
    test('breaks an offset tie in favour of the earlier-listed mention', () {
      final out = reconcileMentions('Cà phê Phở bò', [
        _mention('Cà phê', 0),
        _mention('Phở bò', 0),
      ]);
      expect(out.map((m) => m.label), ['Cà phê', 'Phở bò']);
    });
  });

  group('stripMentions', () {
    test('removes the mention text and trims the leftovers', () {
      expect(stripMentions('Phở bò ', [_mention('Phở bò', 0)]), '');
    });

    test('keeps free text the user typed around it', () {
      expect(
        stripMentions('Phở bò và 2 quả trứng', [_mention('Phở bò', 0)]),
        'và 2 quả trứng',
      );
    });

    test('does not rewrite a surviving mention that contains a double space', () {
      // A `meal` candidate's label is `raw_input` — free user text, so a double
      // space is reachable. Collapsing whitespace across the WHOLE value (what
      // this used to do) rewrote the survivor's label, and the next reconcile
      // then dropped its reference while its staged row stayed on screen.
      const kept = 'phở bò  với trà đá';
      const value = '$kept Phở gà ';
      final survivor = _mention(kept, 0, stageId: 'keep');

      final out = stripMentions(value, [_mention('Phở gà', kept.length + 1)]);

      expect(out, contains(kept));
      expect(
        reconcileMentions(out, [survivor]),
        hasLength(1),
        reason: 'the surviving pick lost its reference',
      );
    });

    test('still collapses the gap the removal itself left behind', () {
      expect(
        stripMentions('sáng Phở bò nay', [_mention('Phở bò', 5)]),
        'sáng nay',
      );
    });

    test('removes several mentions without corrupting the offsets', () {
      expect(
        stripMentions('Phở bò và Cà phê xong', [
          _mention('Phở bò', 0),
          _mention('Cà phê', 10),
        ]),
        'và xong',
      );
    });
  });

  group('buildMentionSegments', () {
    test('marks the mention run and leaves the rest plain', () {
      final segments = buildMentionSegments('sáng Phở bò nhé', [
        _mention('Phở bò', 5),
      ]);
      expect(segments, [
        const MentionSegment(text: 'sáng ', isMention: false),
        const MentionSegment(text: 'Phở bò', isMention: true),
        const MentionSegment(text: ' nhé', isMention: false),
      ]);
    });

    test('reproduces the value exactly — the painted spans depend on it', () {
      const value = 'Phở bò và Cà phê xong';
      final segments = buildMentionSegments(value, [
        _mention('Phở bò', 0),
        _mention('Cà phê', 10),
      ]);
      expect(segments.map((s) => s.text).join(), value);
    });

    test('handles a value that is nothing but a mention', () {
      expect(buildMentionSegments('Phở bò', [_mention('Phở bò', 0)]), [
        const MentionSegment(text: 'Phở bò', isMention: true),
      ]);
    });

    test('ignores a mention whose offsets fall outside the value', () {
      final segments = buildMentionSegments('Phở', [_mention('Phở bò', 0)]);
      expect(segments.map((s) => s.text).join(), 'Phở');
    });
  });
}
