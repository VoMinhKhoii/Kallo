import { retryAccountDeletionJobs } from '@/lib/domain/account-deletion/jobs';
import { retryAppleRevocations } from '@/lib/domain/apple-sign-in/revocation-outbox';

// Two independent outboxes: RevenueCat erasure and Sign in with Apple token
// revocation. Neither run blocks the other; either failing fails the job.
const [erasure, apple] = await Promise.allSettled([
  retryAccountDeletionJobs(),
  retryAppleRevocations(),
]);

function summarize(outcome: PromiseSettledResult<{ failed: number }>): {
  ok: boolean;
  result: unknown;
} {
  if (outcome.status === 'rejected') {
    return { ok: false, result: { error: String(outcome.reason) } };
  }
  return { ok: outcome.value.failed === 0, result: outcome.value };
}

const revenueCat = summarize(erasure);
const appleRevocation = summarize(apple);
console.log(
  JSON.stringify({
    revenueCat: revenueCat.result,
    appleRevocation: appleRevocation.result,
  })
);
if (!(revenueCat.ok && appleRevocation.ok)) process.exitCode = 1;
