import { authPolicies } from './policy-sets/auth';
import { spendPolicies } from './policy-sets/spend';
import { surfacePolicies } from './policy-sets/surfaces';
import type { RateLimitPolicy } from './types';

/**
 * The policy registry. DATA ONLY — no branching, no env reads. The policies
 * themselves are grouped in `policy-sets/` (auth, surfaces, spend); this is
 * the one table they are read through.
 *
 * Limits live here rather than at the call sites so that "what is this route's
 * ceiling, and what happens when the limiter breaks" is one table you can read
 * top to bottom, and so a new call site cannot invent its own failure
 * semantics. Constants rather than env overrides on purpose: a limit that can
 * be changed by an environment variable is a limit nobody can reason about
 * from the code, and every one of these was chosen against a specific abuse.
 *
 * Shape of the numbers:
 *  - IP limits are deliberately GENEROUS. CGNAT, campus NAT and corporate
 *    egress put thousands of unrelated people behind one address; a tight IP
 *    limit locks a university out long before it inconveniences an attacker
 *    with a botnet.
 *  - `account` / `recipient` limits are the strict ones. They are keyed on the
 *    thing being attacked (the mailbox being bombed, the account being
 *    brute-forced), so they cannot be escaped by rotating source addresses.
 *  - `global` budgets are the botnet backstop: they cap total spend even when
 *    no individual key looks abusive.
 *  - `failMode: 'memory'` policies carry a `perMinute` and NOTHING else. The
 *    per-instance bucket is a rate, not a quota, so an hour or day number on
 *    one would be unenforceable — the type refuses it.
 */
export const rateLimitPolicies = {
  ...authPolicies,
  ...surfacePolicies,
  ...spendPolicies,
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof rateLimitPolicies;

export function getRateLimitPolicy(name: RateLimitPolicyName): RateLimitPolicy {
  return rateLimitPolicies[name];
}
