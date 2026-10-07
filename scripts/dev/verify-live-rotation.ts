import '@/lib/__test-utils__/server-only-shim';
import { GoogleGenAI } from '@google/genai';
import { createChatSessionStore } from '@/lib/ai/cache/chat-session';
import {
  createKeyPool,
  executeWithFailover,
  parseKeyList,
} from '@/lib/ai/provider/provider';

function maskKey(key: string): string {
  if (key.length <= 8) return '***';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

async function runLiveVerification() {
  console.log('='.repeat(70));
  console.log('  KALLO AI: LIVE KEY ROTATION & CONTEXT RETENTION VERIFICATION');
  console.log('='.repeat(70));

  const rawKeys =
    process.env.GEMINI_API_KEYS?.trim() || process.env.GEMINI_API_KEY?.trim();

  if (!rawKeys) {
    console.error('\n❌ No Gemini API keys found in environment.');
    console.log('\nTo run this live test, provide keys via .env.local:');
    console.log(
      '  bun --env-file=.env.local scripts/dev/verify-live-rotation.ts'
    );
    console.log('\nOr run with inline environment variables:');
    console.log(
      '  GEMINI_API_KEYS="AIzaSyKey1...,AIzaSyKey2..." bun scripts/dev/verify-live-rotation.ts\n'
    );
    process.exitCode = 1;
    return;
  }

  const keys = parseKeyList(rawKeys);
  console.log(`\n[STEP 1] Initializing In-Process Key Pool`);
  console.log(`  Total Keys Configured : ${keys.length}`);
  keys.forEach((k, idx) => {
    console.log(`  - Key #${idx + 1}             : ${maskKey(k)}`);
  });

  const pool = createKeyPool(keys, { cooldownMs: 60_000 });
  const sessionStore = createChatSessionStore();
  const sessionId = `live_verify_${Date.now()}`;
  const model = process.env.GEMINI_TEST_MODEL || 'gemini-3.1-flash-lite';

  console.log(`  Target Gemini Model   : ${model}`);
  console.log(`  Session ID            : ${sessionId}`);

  // Cache of GoogleGenAI SDK instances
  const clientMap = new Map<string, GoogleGenAI>();
  function getClient(apiKey: string): GoogleGenAI {
    let client = clientMap.get(apiKey);
    if (!client) {
      client = new GoogleGenAI({ apiKey });
      clientMap.set(apiKey, client);
    }
    return client;
  }

  const targetQuantity = '120g';
  const targetIngredient = 'thịt bắp bò';

  // ── TURN 1 ────────────────────────────────────────────────────────────────
  console.log(`\n[STEP 2] Executing Turn 1 (Meal Description Prompt)`);
  const prompt1 = `Tôi ăn trưa: 1 bát Phở bò với 150g bánh phở và ${targetQuantity} ${targetIngredient}. Hãy xác nhận chi tiết món ăn trong 1 câu ngắn.`;
  console.log(`  Turn 1 Input : "${prompt1}"`);

  sessionStore.appendMessage(sessionId, {
    role: 'system',
    content:
      'Bạn là chuyên gia dinh dưỡng Kallo. Hãy trả lời ngắn gọn, chính xác số gam.',
  });
  sessionStore.appendMessage(sessionId, { role: 'user', content: prompt1 });

  let turn1Key = '';
  const t0Turn1 = Date.now();

  const reply1 = await executeWithFailover({
    primaryPool: pool,
    messages: sessionStore.formatForGenericLlm(sessionStore.get(sessionId)!),
    executePrimary: async (key) => {
      turn1Key = key;
      const ai = getClient(key);
      const formatted = sessionStore.formatForGemini(
        sessionStore.get(sessionId)!
      );
      const res = await ai.models.generateContent({
        model,
        contents: formatted.contents,
        config: {
          systemInstruction: formatted.systemInstruction,
          temperature: 0.2,
        },
      });
      return {
        text: res.text ?? '',
        usage: res.usageMetadata,
      };
    },
  });

  const durationTurn1 = Date.now() - t0Turn1;
  console.log(`  Turn 1 Key   : ${maskKey(turn1Key)}`);
  console.log(`  Turn 1 Reply : "${reply1.text.trim()}"`);
  console.log(`  Latency      : ${durationTurn1} ms`);
  if (reply1.usage) {
    console.log(
      `  Token Usage  : Prompt=${reply1.usage.promptTokenCount}, Output=${reply1.usage.candidatesTokenCount}, Total=${reply1.usage.totalTokenCount}`
    );
  }

  sessionStore.appendMessage(sessionId, {
    role: 'assistant',
    content: reply1.text,
  });

  // ── TURN 2 (Testing Context Recall Across Turns) ───────────────────────────
  console.log(`\n[STEP 3] Executing Turn 2 (Context Recall & Caching)`);
  const prompt2 =
    'Trong bữa Phở bò tôi vừa ăn có chính xác bao nhiêu gam thịt bắp bò?';
  console.log(`  Turn 2 Input : "${prompt2}"`);
  sessionStore.appendMessage(sessionId, { role: 'user', content: prompt2 });

  let turn2Key = '';
  const t0Turn2 = Date.now();

  const reply2 = await executeWithFailover({
    primaryPool: pool,
    messages: sessionStore.formatForGenericLlm(sessionStore.get(sessionId)!),
    executePrimary: async (key) => {
      turn2Key = key;
      const ai = getClient(key);
      const formatted = sessionStore.formatForGemini(
        sessionStore.get(sessionId)!
      );
      let lastError: unknown;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await ai.models.generateContent({
            model,
            contents: formatted.contents,
            config: {
              systemInstruction: formatted.systemInstruction,
              temperature: 0.1,
            },
          });
          return {
            text: res.text ?? '',
            usage: res.usageMetadata,
          };
        } catch (err) {
          lastError = err;
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('503') || msg.includes('UNAVAILABLE')) {
            console.log(
              `  [503 Spike] Model busy, retrying attempt ${attempt + 1}/3 in 1500ms...`
            );
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          throw err;
        }
      }
      throw lastError;
    },
  });

  const durationTurn2 = Date.now() - t0Turn2;
  console.log(`  Turn 2 Key   : ${maskKey(turn2Key)}`);
  console.log(`  Turn 2 Reply : "${reply2.text.trim()}"`);
  console.log(`  Latency      : ${durationTurn2} ms`);

  if (reply2.usage) {
    console.log(
      `  Token Usage  : Prompt=${reply2.usage.promptTokenCount}, Output=${reply2.usage.candidatesTokenCount}, Total=${reply2.usage.totalTokenCount}`
    );
    if (reply2.usage.cachedContentTokenCount) {
      console.log(
        `  ⚡ Cache Hit : ${reply2.usage.cachedContentTokenCount} cached tokens discounted!`
      );
    }
  }

  // ── VERIFICATION SUMMARY ──────────────────────────────────────────────────
  const contextPreserved =
    reply2.text.includes(targetQuantity) ||
    reply2.text.toLowerCase().includes('120');

  console.log(`\n[STEP 4] Multi-Turn Verification Summary`);
  console.log(
    `  - Key Distribution   : Turn 1 (${maskKey(turn1Key)}) -> Turn 2 (${maskKey(turn2Key)})`
  );
  console.log(
    `  - Context Recalled   : ${contextPreserved ? '✅ PASS (Correctly recalled 120g bắp bò)' : '❌ FAIL'}`
  );

  // ── DEMO: SIMULATED KEY ROTATION ──────────────────────────────────────────
  if (keys.length > 1) {
    console.log(`\n[STEP 5] Live Quarantine & Rotation Test`);
    console.log(`  Quarantining ${maskKey(turn1Key)} for 60 seconds...`);
    pool.markQuarantine(turn1Key, 'Simulated 429 quota exhaustion');

    const nextAcquired = pool.acquireKey();
    console.log(
      `  Next Acquired Key    : ${nextAcquired ? maskKey(nextAcquired.key) : 'None'}`
    );
    console.log(
      `  Failover Immediate   : ${nextAcquired && nextAcquired.key !== turn1Key ? '✅ PASS (Zero-wait switch)' : '❌ FAIL'}`
    );
  }

  console.log(`\n${'='.repeat(70)}\n`);
}

runLiveVerification().catch((err) => {
  console.error('\nFatal Live Verification Error:', err);
  process.exitCode = 1;
});
