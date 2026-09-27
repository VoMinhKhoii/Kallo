import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/models/logging/streaming.dart';

StreamErrorEvent _refused(int status, String code) => StreamErrorEvent(
  code: code,
  message: 'refused',
  retryable: false,
  status: status,
);

void main() {
  group('classifyPreStreamRefusal', () {
    test('a plain 403 is an error, not a consent prompt', () {
      // The origin lock, a WAF or Cloud Run — whatever code the client
      // derived from a body that was not ours.
      for (final code in ['HTTP_ERROR', 'FORBIDDEN', 'NOT_AUTHENTICATED']) {
        expect(classifyPreStreamRefusal(403, code), PreStreamRefusal.error);
        final event = _refused(403, code);
        expect(event.isAiConsentRequired, isFalse);
        expect(event.isPaymentRequired, isFalse);
      }
    });

    test('a 403 carrying ai_consent_required asks for consent', () {
      expect(
        classifyPreStreamRefusal(403, 'ai_consent_required'),
        PreStreamRefusal.consentRequired,
      );
      expect(_refused(403, 'ai_consent_required').isAiConsentRequired, isTrue);
    });

    test('a 402 is paymentRequired, whatever the code', () {
      expect(
        classifyPreStreamRefusal(402, 'feature_locked'),
        PreStreamRefusal.paymentRequired,
      );
      expect(_refused(402, 'anything').isPaymentRequired, isTrue);
    });

    test('a transport error with no status is an error', () {
      expect(
        classifyPreStreamRefusal(null, 'CONNECTION_ERROR'),
        PreStreamRefusal.error,
      );
    });
  });
}
