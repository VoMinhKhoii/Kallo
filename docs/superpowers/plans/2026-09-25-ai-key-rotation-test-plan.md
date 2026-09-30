# AI Key Rotation & Context Caching — Comprehensive Test Case Plan

**Specification:** [`docs/AI_KEY_ROTATION_AND_CACHING.md`](file:///e:/Smolfish/nham1/Nham/docs/AI_KEY_ROTATION_AND_CACHING.md)  
**Implementation Plan:** [`docs/superpowers/plans/2026-09-25-ai-key-rotation-and-caching.md`](file:///e:/Smolfish/nham1/Nham/docs/superpowers/plans/2026-09-25-ai-key-rotation-and-caching.md)  
**Test Runner:** Vitest via `bun run test` (strictly required by [`AGENTS.md`](file:///e:/Smolfish/nham1/Nham/AGENTS.md) §3)

---

## 1. Test Architecture & Coverage Matrix

The test suite is organized into 4 distinct testing boundaries:

```
lib/ai/
├── cache/__tests__/
│   └── chat-session.test.ts          — Suite 1: Session Context & Serialization
├── provider/
│   ├── pool/__tests__/
│   │   ├── key-pool.test.ts          — Suite 2: In-Process Key Pool & Quarantine Engine
│   │   └── fallback-router.test.ts   — Suite 3: Multi-Provider Tier-2 Fallback
│   └── __tests__/
│       └── provider-rotation.test.ts — Suite 4: End-to-End Failover Integration
```

---

## 2. Test Suite 1: Multi-Turn Chat Session & Context Storage
**File:** `lib/ai/cache/__tests__/chat-session.test.ts`

### TC-1.1: Basic Message Lifecycle & Ordering
* **Description:** Verifies that sequential user and assistant messages append in exact chronological order.
* **Input:**
  - Create session `sess_01`.
  - Append `user: "1 bowl of pho bo with 150g noodles and 120g beef"`.
  - Append `assistant: "Logged 1 bowl of Pho Bo (150g rice noodles, 120g beef)"`.
  - Append `user: "How much protein was in that?"`.
* **Expected Result:**
  - `session.messages` has length 3.
  - Message sequence is strictly ordered: `[User, Assistant, User]`.
  - Timestamps are monotonically increasing.

### TC-1.2: Provider-Specific Prompt Formatting
* **Description:** Verifies normalized `ChatMessage[]` converts cleanly into Google GenAI `Content[]` structure.
* **Input:** 3-turn normalized session.
* **Expected Result:**
  - `formatForGemini(session)` returns `Content[]` with roles `user` and `model`.
  - System instructions are properly placed in `systemInstruction` slot, not prepended as user content.
  - Formatting preserves Vietnamese diacritics without ASCII flattening.

### TC-1.3: Sliding Window Trimming (Memory Bound)
* **Description:** Prevents unbounded memory growth in long conversations.
* **Setup:** Session store configured with `maxTurns: 10`.
* **Input:** Append 15 consecutive message pairs (30 messages total).
* **Expected Result:**
  - Total messages stored capped at 20 (10 turns).
  - Oldest 10 messages evicted; most recent 20 messages retained.
  - No index out-of-bounds or array corruption.

### TC-1.4: Inactive Session TTL Eviction
* **Description:** Inactive chat sessions must be cleared after TTL to prevent memory leaks.
* **Setup:** Store configured with `ttlMs: 1800000` (30 min) and injectable clock `now()`.
* **Input:**
  - Create session `sess_old` at $t = 0$.
  - Advance mock clock to $t = 31\text{ minutes}$.
  - Request `sess_old`.
* **Expected Result:**
  - Lookup returns `null`.
  - Cache size drops back to 0.

---

## 3. Test Suite 2: In-Process Key Pool & Cooldown Quarantine
**File:** `lib/ai/provider/pool/__tests__/key-pool.test.ts`

### TC-2.1: Round-Robin Distribution under Healthy Traffic
* **Description:** Verifies even traffic distribution across all active keys in the pool.
* **Setup:** Pool with 3 keys: `['KEY_A', 'KEY_B', 'KEY_C']`.
* **Input:** Call `acquireKey()` 6 times.
* **Expected Result:**
  - Sequence of returned keys: `KEY_A -> KEY_B -> KEY_C -> KEY_A -> KEY_B -> KEY_C`.
  - Each key receives exactly 2 requests.

### TC-2.2: 429 Quota Quarantine & Zero-Wait Rotation
* **Description:** When a key hits 429, it must be quarantined for 60s and the next key returned immediately with zero sleep delay.
* **Setup:** Pool with `['KEY_A', 'KEY_B']`.
* **Action:**
  1. `acquireKey()` returns `KEY_A`.
  2. Mark `KEY_A` with 429 error via `markQuarantine('KEY_A', '429 Quota Exceeded')`.
  3. Call `acquireKey()` immediately.
* **Expected Result:**
  - Elapsed time is < 5 ms (zero sleep).
  - Next key returned is `KEY_B`.
  - `KEY_A` status is `quarantined`.
  - Subsequent 5 calls to `acquireKey()` return exclusively `KEY_B`.

### TC-2.3: Automatic Recovery after 60-Second Cooldown
* **Description:** Quarantined keys must re-enter rotation once their 60s window expires.
* **Setup:** Injectable clock. `KEY_A` quarantined at $t = 0$ with `cooldownMs = 60000`.
* **Input:**
  - At $t = 30\text{s}$: `acquireKey()` returns `KEY_B` (KEY_A still cooled).
  - At $t = 61\text{s}$: `acquireKey()` called.
* **Expected Result:**
  - `KEY_A` automatically transitions back to `active`.
  - Round-robin resumes across both `KEY_A` and `KEY_B`.

### TC-2.4: Permanent Quarantine for Invalid Credentials (401/403)
* **Description:** Keys with authentication or permission errors must never be retried.
* **Setup:** Pool with `['KEY_INVALID', 'KEY_VALID']`.
* **Action:** `markRevoked('KEY_INVALID', '403 API_KEY_INVALID')`.
* **Expected Result:**
  - `KEY_INVALID` status is set to `revoked`.
  - Even after advancing clock by 10 hours, `KEY_INVALID` is never returned.
  - Status snapshot reports `{ active: 1, quarantined: 0, revoked: 1 }`.

### TC-2.5: Total Pool Exhaustion Signaling
* **Description:** What happens when all keys in the primary pool hit 429.
* **Setup:** Pool with 2 keys. Both marked quarantined.
* **Input:** Call `acquireKey()`.
* **Expected Result:**
  - Returns `null` (or throws typed `KeyPoolExhaustedError`).
  - Contains timestamps indicating when the earliest key will recover.
  - Triggers Tier-2 fallback router.

---

## 4. Test Suite 3: Multi-Provider Tier-2 Fallback
**File:** `lib/ai/provider/pool/__tests__/fallback-router.test.ts`

### TC-3.1: Primary Route Preference
* **Description:** As long as at least one Gemini key is active, fallback models are never invoked.
* **Setup:** Mock Gemini adapter, mock Claude adapter. Primary pool healthy.
* **Input:** Dispatch request.
* **Expected Result:**
  - Executed via Gemini adapter.
  - Claude adapter call count is 0.

### TC-3.2: Seamless Fallback Execution on Pool Exhaustion
* **Description:** When all Gemini keys are in cooldown, request transparently executes on Claude 3.5 Haiku.
* **Setup:** All Gemini keys marked quarantined.
* **Input:** Dispatch request.
* **Expected Result:**
  - Router detects primary exhaustion.
  - Dispatches to Claude adapter.
  - Returns valid `PipelineResponse`.
  - Telemetry event records `workKind: 'primary', provider: 'claude', fallbackFired: true`.

### TC-3.3: Context Preservation on Fallback Model
* **Description:** Fallback provider receives the complete normalized conversation history.
* **Setup:** Multi-turn session with 3 prior turns. Gemini pool exhausted on Turn 4.
* **Input:** Dispatch Turn 4.
* **Expected Result:**
  - Fallback provider mock receives full array of 4 messages.
  - No messages dropped or corrupted during cross-provider translation.

---

## 5. Test Suite 4: End-to-End Failover & Context Retention Integration
**File:** `lib/ai/provider/__tests__/provider-rotation.test.ts`

### TC-4.1: The Core Multi-Turn Rotation Scenario
* **Scenario:**
  - **Turn 1**: User asks: *"I ate 1 bowl of pho bo with 150g rice noodles and 120g beef shank."*
    - Executed on `KEY_1`.
    - Key 1 returns: *"Noted: 1 bowl Pho Bo with 150g rice noodles and 120g beef shank."*
  - **Turn 2**: User asks: *"How many grams of beef shank did I just log?"*
    - Request begins on `KEY_1`.
    - Simulate: `KEY_1` returns `429 RESOURCE_EXHAUSTED`.
* **Expected Behavior:**
  1. `retry.ts` catches 429.
  2. `KEY_1` quarantined for 60s.
  3. `KEY_2` selected immediately (0 ms sleep).
  4. Full conversation from Turn 1 is passed to `KEY_2`.
  5. `KEY_2` generates reply acknowledging: *"You logged 120g of beef shank."*
  6. Call succeeds with HTTP 200 to the user.

---

## 6. Critical Edge Cases

### EC-1: Concurrent 429 Stampede
* **Condition:** 10 concurrent requests in-flight when `KEY_1` hits quota limit.
* **Challenge:** Prevent race conditions where `KEY_1` cooldown is overwritten or all 10 fail simultaneously.
* **Expected Behavior:**
  - First request that receives 429 marks `KEY_1` quarantined.
  - Remaining 9 concurrent requests immediately redirect to `KEY_2` and `KEY_3`.
  - Cooldown timer is atomic; no unhandled promise rejections.

### EC-2: Single Key Configuration (Backward Compatibility)
* **Condition:** Production has only 1 key set (`GEMINI_API_KEY="AIzaSySingle"`).
* **Challenge:** Pool cannot rotate to a non-existent secondary key.
* **Expected Behavior:**
  - Pool size = 1.
  - On 429: detects no alternate keys available in pool.
  - Degrades gracefully to standard exponential backoff retry (honoring `retry-after` header) rather than an infinite rotation loop.

### EC-3: Malformed Secret String Parsing
* **Condition:** Environment variable contains messy input:  
  `GEMINI_API_KEYS=" AIzaKey1, , AIzaKey2 , AIzaKey3, "`
* **Expected Behavior:**
  - Parser trims whitespace, strips empty items, and removes trailing commas.
  - Resulting pool has exactly 3 clean keys: `['AIzaKey1', 'AIzaKey2', 'AIzaKey3']`.

### EC-4: Non-Quota Error Discrimination
* **Condition:** Request fails with 400 Bad Request (malformed input) or Zod schema validation error.
* **Expected Behavior:**
  - The API key was NOT at fault.
  - Key is **NOT** quarantined.
  - Request routes to standard schema retry or throws 400 immediately.

### EC-5: Client Request Abort (`AbortSignal`) Mid-Failover
* **Condition:** User closes browser tab while request is failing over between Key 1 and Key 2.
* **Expected Behavior:**
  - `AbortSignal.aborted === true` is checked before dispatching to Key 2.
  - Execution halts immediately; no orphaned background tokens billed.
  - Throws standard `AbortError`.

### EC-6: Memory Leak Guard under Massive Session Load
* **Condition:** 10,000 distinct chat sessions created within 5 minutes.
* **Expected Behavior:**
  - `l4-cache` strictly enforces `maxEntries` (e.g. 500 active sessions in memory).
  - Oldest sessions evicted via LRU policy.
  - Node.js heap usage remains flat (< 50MB RSS increase).
