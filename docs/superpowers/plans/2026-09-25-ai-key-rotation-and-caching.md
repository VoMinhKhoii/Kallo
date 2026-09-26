# In-Process AI Key Rotation & Multi-Turn Context Caching Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement zero-cost, in-process API key rotation with automatic 60-second 429 quarantining, external fallback routing, and multi-turn conversational context retention, fully retiring LiteLLM to eliminate cloud server costs.

**Architecture:** Native TypeScript engine inside `lib/ai/provider/` and `lib/ai/cache/`. Comma-separated key pool (`GEMINI_API_KEYS`), in-memory round-robin router with quarantine tracking, normalized canonical context storage (`ChatMessage[]`) preventing cross-project cache amnesia, and immediate turn-level failover.

**Tech Stack:** Next.js 16 (App Router), Bun, TypeScript, Google Cloud Run (`--min-instances=0`), Google Secret Manager, `@google/genai`, Vitest, Biome.

**Governing Spec:** [`docs/AI_KEY_ROTATION_AND_CACHING.md`](file:///e:/Smolfish/nham1/Nham/docs/AI_KEY_ROTATION_AND_CACHING.md)  
**Operating Rules:** [`AGENTS.md`](file:///e:/Smolfish/nham1/Nham/AGENTS.md) (≤10 files/folder, 400 LOC max, `lib/ai/provider/` sole LLM seam, `bun run test`).

---

## 1. File Structure & Boundaries

### Created Files
- `lib/ai/cache/chat-session.ts` — Canonical multi-turn session memory & prompt re-seeding adapter (≤150 LOC).
- `lib/ai/cache/__tests__/chat-session.test.ts` — Unit tests for session lifecycle, trimming, and serialization.
- `lib/ai/provider/pool/types.ts` — Key pool status, quarantine reasons, and router contracts (≤80 LOC).
- `lib/ai/provider/pool/key-pool.ts` — Round-robin active key selector, 60s 429 quarantine, and auto-recovery (≤180 LOC).
- `lib/ai/provider/pool/fallback-router.ts` — Tier-2 provider failover (Gemini $\to$ Claude 3.5 Haiku / GPT-4o-mini) (≤150 LOC).
- `lib/ai/provider/pool/__tests__/key-pool.test.ts` — Unit tests for rotation, quarantine, and zero-wait failover.
- `lib/ai/provider/pool/__tests__/fallback-router.test.ts` — Tests for multi-provider fallback and context retention.

### Modified Files
- `lib/ai/provider/client.ts` — Support comma-separated `GEMINI_API_KEYS` alongside legacy single key; wire pool client.
- `lib/ai/provider/retry.ts` — Intercept 429 status to trigger key quarantine and immediate pool rotation without sleep.
- `lib/ai/provider/provider.ts` — Re-export pool contracts from the `lib/ai/provider` boundary.
- `lib/ai/pipeline/telemetry/budget.ts` — Log key rotation and quarantine events in model budget attribution.

---

## 2. Verification Commands

- **Structure & Size Gate**: `bun check:structure` (Strict LOC & folder file count enforcement)
- **Code Quality & Lint**: `bunx @biomejs/biome check .`
- **Unit Test Suite**: `bun run test -- lib/ai/provider/pool/ lib/ai/cache/`
- **Full AI Suite**: `bun run test -- lib/ai/`

---

## 3. Implementation Phases

### Phase 1: Canonical Chat Session & Context Storage
*Objective: Build the application-level context retention layer that stores normalized turns and prevents context loss across rotated keys.*

- [ ] **1.1 Define Chat Message & Session Types** in `lib/ai/cache/chat-session.ts`:
  - Declare `ChatMessage { role: 'user' | 'assistant' | 'system', content: string, timestamp: number }`.
  - Declare `ChatSession { sessionId: string, messages: ChatMessage[], lastActiveAt: number }`.
  - Declare `ChatSessionStore` interface with `get`, `append`, `clear`, and `formatForPrompt`.
- [ ] **1.2 Implement Bounded In-Memory Session Store**:
  - Integrate with [`lib/ai/cache/l4-cache.ts`](file:///e:/Smolfish/nham1/Nham/lib/ai/cache/l4-cache.ts) for TTL-based session eviction (e.g. 30-minute idle TTL).
  - Implement message history sliding-window cap (e.g. max 20 turns) to prevent unbounded memory growth.
- [ ] **1.3 Add Provider Prompt Re-seeding Serializer**:
  - Implement `formatForGemini(session: ChatSession): Content[]` transforming normalized turns to Google GenAI contents.
  - Implement `formatForGenericLlm(session: ChatSession): Array<{ role: string, content: string }>`.
- [ ] **1.4 Unit Tests in `lib/ai/cache/__tests__/chat-session.test.ts`**:
  - Verify message appending preserves chronological sequence.
  - Verify sliding window trims oldest turns while preserving system instructions.
  - Verify TTL expiry clears inactive sessions.
  - Test command: `bun run test -- lib/ai/cache/__tests__/chat-session.test.ts`.

---

### Phase 2: In-Process Key Pool & Cooldown Quarantine
*Objective: Manage a pool of Gemini API keys with round-robin dispatch, instant 429 quarantining, and 60-second recovery.*

- [ ] **2.1 Define Pool Types** in `lib/ai/provider/pool/types.ts`:
  - `KeyStatus: 'active' | 'quarantined' | 'revoked'`
  - `QuarantineRecord: { key: string, status: KeyStatus, cooldownUntil: number, failureCount: number, lastError?: string }`
  - `KeyPoolConfig: { cooldownMs?: number, maxFailuresBeforeRevoke?: number }`
- [ ] **2.2 Implement `KeyPool`** in `lib/ai/provider/pool/key-pool.ts`:
  - `createKeyPool(keys: string[], config?: KeyPoolConfig)`
  - `acquireKey(): { key: string, index: number } | null`: Round-robin across currently unquarantined keys.
  - `markQuarantine(key: string, reason: string, customCooldownMs?: number)`: Sets `cooldownUntil = Date.now() + 60_000`.
  - `markRevoked(key: string)`: Permanent quarantine for 401/403 invalid credentials.
  - `getStatusSnapshot()`: Returns active, cooling, and revoked counts for telemetry.
- [ ] **2.3 Unit Tests in `lib/ai/provider/pool/__tests__/key-pool.test.ts`**:
  - Verify round-robin distributes evenly across active keys.
  - Verify key hitting 429 is bypassed on subsequent `acquireKey()` calls.
  - Verify zero-sleep immediate availability of secondary keys.
  - Verify key is restored to rotation after mock timer passes 60 seconds.
  - Test command: `bun run test -- lib/ai/provider/pool/__tests__/key-pool.test.ts`.

---

### Phase 3: Provider Failover Router (Gemini $\to$ Fallback)
*Objective: Route traffic seamlessly to external fallback models (Claude 3.5 Haiku / GPT-4o-mini) when all Gemini keys are in quarantine.*

- [ ] **3.1 Implement `FallbackRouter`** in `lib/ai/provider/pool/fallback-router.ts`:
  - Wrap primary `KeyPool` with fallback dispatch logic.
  - Check if primary pool is exhausted (`acquireKey() === null`).
  - If exhausted, delegate execution to the secondary provider configured in [`lib/ai/pipeline/estimator/select.ts`](file:///e:/Smolfish/nham1/Nham/lib/ai/pipeline/estimator/select.ts) (`claude` or `openai`).
- [ ] **3.2 Context Preservation on Failover**:
  - Pass the canonical normalized message history (`ChatMessage[]`) from Phase 1 to the fallback adapter.
  - Ensure fallback provider receives full conversational state.
- [ ] **3.3 Unit Tests in `lib/ai/provider/pool/__tests__/fallback-router.test.ts`**:
  - Verify primary pool is prioritized when at least 1 key is healthy.
  - Verify fallback triggers when all primary keys are quarantined.
  - Verify context array is transmitted intact to fallback mock.
  - Test command: `bun run test -- lib/ai/provider/pool/__tests__/fallback-router.test.ts`.

---

### Phase 4: Integration with Provider Client & Retry Loop
*Objective: Connect the key pool and retry logic so that live calls automatically fail over without user disruption.*

- [ ] **4.1 Update `lib/ai/provider/client.ts`**:
  - Parse `GEMINI_API_KEYS` (comma-separated) or fall back to single `GEMINI_API_KEY`.
  - Initialize the pool when multiple keys are detected.
  - Support `getOrCreateAiClientForKey(apiKey: string)`.
- [ ] **4.2 Update `lib/ai/provider/retry.ts`**:
  - In `createWithRetry`, intercept error status:
    - If status === 429 (`rate_limit` / `quota`), mark the failing key in cooldown immediately.
    - Rather than sleeping `baseDelayMs * 2^attempt`, check if an alternative key is available.
    - If an alternate key exists in the pool, re-dispatch immediately (0 ms backoff).
    - If all keys are cooled, honor standard backoff or route to fallback.
- [ ] **4.3 Telemetry & Budget Integration**:
  - In [`lib/ai/pipeline/telemetry/budget.ts`](file:///e:/Smolfish/nham1/Nham/lib/ai/pipeline/telemetry/budget.ts), attach `poolSnapshot` and `keyRotationCount` to `analysis_model_budget_events`.
- [ ] **4.4 Integration Tests in `lib/ai/provider/__tests__/provider-pool-integration.test.ts`**:
  - Multi-turn simulated failover test:
    - Turn 1: Successfully calls with Key 1.
    - Turn 2: Key 1 throws 429 Quota Exceeded.
    - Assert: Key 1 marked in cooldown, Key 2 immediately invoked, Turn 2 completes successfully with Turn 1 context acknowledged.

---

### Phase 5: Production Configuration, Cleanup & Verification
*Objective: Configure GCP Secret Manager, clean up obsolete LiteLLM artifacts, and pass all CI quality gates.*

- [ ] **5.1 Retire LiteLLM Artifacts**:
  - Remove prototype files: `docker-compose.litellm.yml`, `litellm/config.yaml`, and `scripts/dev/test-litellm-failover.ts`.
  - Remove any unused dependencies from `package.json` using `bun remove`.
- [ ] **5.2 Update Production Cloud Run Workflow**:
  - In [`.github/workflows/cloud-run-prod.yml`](file:///e:/Smolfish/nham1/Nham/.github/workflows/cloud-run-prod.yml), document the secret mapping:
    `GEMINI_API_KEYS=kallo-prod-gemini-api-keys:latest` (or backward-compatible `GEMINI_API_KEY`).
- [ ] **5.3 Run Verification Suite**:
  - Run structure gate: `bun check:structure`.
  - Run Biome check: `bunx @biomejs/biome check .`.
  - Run test suite: `bun run test`.
  - Verify zero LOC violations (no files > 400 lines) and ≤10 files per folder.
