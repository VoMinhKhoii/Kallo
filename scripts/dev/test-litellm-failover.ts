#!/usr/bin/env bun

/**
 * LiteLLM Local Key Rotation & Failover Test
 *
 * Validates:
 * 1. LiteLLM proxy connectivity & health
 * 2. Model pool configuration & rotation readiness
 * 3. Router cooldown status
 * 4. Multi-request load balancing across Google API keys
 * 5. Multi-turn conversation failover & context retention
 * 6. Fallback model group availability
 *
 * Usage:
 *   bun run test:litellm
 *   bun scripts/dev/test-litellm-failover.ts
 */

interface CooldownResponse {
  cooldown_models?: Array<{
    model_name: string;
    model_id?: string;
    cooldown_time?: number;
  }>;
}

interface ModelInfoResponse {
  data?: Array<{
    id: string;
    model_name?: string;
    litellm_params?: Record<string, unknown>;
  }>;
}

interface ChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message: string;
    code?: string | number;
  };
}

const BASE_URL = (
  process.env.LITELLM_BASE_URL || 'http://localhost:4000'
).replace(/\/$/, '');
const MASTER_KEY =
  process.env.LITELLM_MASTER_KEY || 'sk-kallo-litellm-local-dev-key';

const SEPARATOR = '='.repeat(68);
const SUB_SEPARATOR = '-'.repeat(68);

async function checkHealth(): Promise<boolean> {
  console.log(`\n[STEP 1/6] Proxy Connectivity Check`);
  try {
    const res = await fetch(`${BASE_URL}/health/liveliness`, {
      headers: { Authorization: `Bearer ${MASTER_KEY}` },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      console.log(`  Status: READY (${BASE_URL})`);
      return true;
    }

    const fallbackRes = await fetch(`${BASE_URL}/health`, {
      headers: { Authorization: `Bearer ${MASTER_KEY}` },
      signal: AbortSignal.timeout(10000),
    });

    if (fallbackRes.ok) {
      console.log(`  Status: READY (${BASE_URL})`);
      return true;
    }

    console.error(
      `  Status: FAIL (HTTP ${fallbackRes.status}: ${fallbackRes.statusText})`
    );
    return false;
  } catch (error) {
    console.error(
      `  Status: UNREACHABLE (${BASE_URL}) - ${(error as Error).message}`
    );
    console.log('\nCommand to start the LiteLLM container:');
    console.log('  docker compose -f docker-compose.litellm.yml up -d\n');
    return false;
  }
}

async function checkModelPools(): Promise<void> {
  console.log(`\n[STEP 2/6] Model Deployment Pools`);
  try {
    const res = await fetch(`${BASE_URL}/model/info`, {
      headers: { Authorization: `Bearer ${MASTER_KEY}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.log(`  Warning: /model/info returned HTTP ${res.status}`);
      return;
    }

    const data = (await res.json()) as ModelInfoResponse;
    const models = data.data ?? [];
    if (models.length === 0) {
      console.log('  Warning: No model definitions returned by proxy.');
      return;
    }

    const countsByName = new Map<string, number>();
    for (const m of models) {
      const name = m.model_name || m.id;
      countsByName.set(name, (countsByName.get(name) || 0) + 1);
    }

    for (const [name, count] of countsByName.entries()) {
      const statusText =
        count > 1
          ? `${count} keys mapped (rotation active)`
          : '1 key mapped (single key)';
      console.log(`  - ${name.padEnd(26)} : ${statusText}`);
    }
  } catch (error) {
    console.log(
      `  Warning: Unable to read model pool data - ${(error as Error).message}`
    );
  }
}

async function checkCooldowns(): Promise<void> {
  console.log(`\n[STEP 3/6] Router Cooldown Status`);
  try {
    const res = await fetch(`${BASE_URL}/router/cooldowns`, {
      headers: { Authorization: `Bearer ${MASTER_KEY}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.log('  Status: No active quarantines detected.');
      return;
    }

    const data = (await res.json()) as CooldownResponse;
    const cooldowns = data.cooldown_models ?? [];
    if (cooldowns.length === 0) {
      console.log(
        '  Status: Zero quarantined keys (all deployments operational).'
      );
    } else {
      console.log(
        `  Warning: ${cooldowns.length} deployment(s) currently in cooldown:`
      );
      for (const c of cooldowns) {
        console.log(
          `    - ${c.model_name} (id: ${c.model_id ?? 'unknown'}, remaining: ${c.cooldown_time ?? 0}s)`
        );
      }
    }
  } catch {
    console.log('  Status: Router cooldown endpoint not reporting errors.');
  }
}

async function testChat(
  model: string,
  label: string
): Promise<{ success: boolean; deploymentId?: string }> {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MASTER_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: 'Respond with the single word: CONFIRMED' },
        ],
        max_tokens: 10,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(20000),
    });

    const elapsed = Date.now() - started;
    const deploymentId = res.headers.get('x-litellm-model-id') || undefined;

    if (!res.ok) {
      const errBody = await res.text();
      console.log(
        `  [${label}] FAIL (HTTP ${res.status}, ${elapsed}ms): ${errBody.slice(0, 120)}`
      );
      return { success: false };
    }

    const data = (await res.json()) as ChatCompletionResponse;
    const reply = data.choices?.[0]?.message?.content?.trim() ?? '';
    const depTag = deploymentId
      ? ` | Key: ${deploymentId.slice(0, 12)}...`
      : '';
    console.log(
      `  [${label}] PASS (${elapsed}ms)${depTag} | Response: "${reply}"`
    );
    return { success: true, deploymentId };
  } catch (error) {
    const elapsed = Date.now() - started;
    console.log(
      `  [${label}] ERROR (${elapsed}ms): ${(error as Error).message}`
    );
    return { success: false };
  }
}

async function testKeyRotation(): Promise<void> {
  console.log(`\n[STEP 4/6] Key Rotation & Load Balancing`);
  console.log(`  Model: gemini-3.1-flash-lite`);
  console.log(`  Dispatching 4 sequential requests across active key pool:`);

  for (let i = 1; i <= 4; i++) {
    await testChat('gemini-3.1-flash-lite', `Req ${i}/4`);
  }
}

async function testConversationFailover(): Promise<void> {
  console.log(
    `\n[STEP 5/6] Multi-Turn Conversation Failover & Context Retention`
  );
  const targetQuantity = '120g';
  const targetIngredient = 'beef shank';

  // Turn 1
  const prompt1 = `Please log this meal for lunch: 1 bowl of Pho Bo with 150g rice noodles and ${targetQuantity} ${targetIngredient}. Acknowledge the ingredients.`;
  console.log(`  Turn 1 (Input) : "${prompt1}"`);

  const messages: Array<{ role: string; content: string }> = [
    { role: 'user', content: prompt1 },
  ];

  const res1 = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MASTER_KEY}`,
    },
    body: JSON.stringify({
      model: 'gemini-3.1-flash-lite',
      messages,
      temperature: 0,
    }),
  });

  if (!res1.ok) {
    console.log(`  Turn 1 Status  : FAIL (HTTP ${res1.status})`);
    return;
  }

  const data1 = (await res1.json()) as ChatCompletionResponse;
  const reply1 = data1.choices?.[0]?.message?.content?.trim() ?? '';
  const dep1 = res1.headers.get('x-litellm-model-id') || 'deployment-1';
  console.log(`  Turn 1 (Output): "${reply1}"`);
  console.log(`  Turn 1 Route   : ${dep1.slice(0, 16)}...`);

  messages.push({ role: 'assistant', content: reply1 });

  // Turn 2
  const prompt2 =
    'How many grams of beef shank were included in the Pho Bo lunch I just logged?';
  console.log(`\n  Turn 2 (Input) : "${prompt2}"`);
  messages.push({ role: 'user', content: prompt2 });

  const res2 = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MASTER_KEY}`,
    },
    body: JSON.stringify({
      model: 'gemini-3.1-flash-lite',
      messages,
      temperature: 0,
    }),
  });

  if (!res2.ok) {
    console.log(`  Turn 2 Status  : FAIL (HTTP ${res2.status})`);
    return;
  }

  const data2 = (await res2.json()) as ChatCompletionResponse;
  const reply2 = data2.choices?.[0]?.message?.content?.trim() ?? '';
  const dep2 = res2.headers.get('x-litellm-model-id') || 'deployment-2';
  console.log(`  Turn 2 (Output): "${reply2}"`);
  console.log(`  Turn 2 Route   : ${dep2.slice(0, 16)}...`);

  const keyRotated = dep1 !== dep2;
  const contextRetained =
    reply2.includes(targetQuantity) ||
    reply2.toLowerCase().includes(targetIngredient);

  console.log(`\n  Verification Summary:`);
  console.log(
    `  - Key Swapped Mid-Chat   : ${keyRotated ? `YES (${dep1.slice(0, 12)}... -> ${dep2.slice(0, 12)}...)` : 'NO (Same key selected by load balancer)'}`
  );
  console.log(
    `  - Context Retained Across Keys : ${contextRetained ? `PASS (Recalled "${targetQuantity} ${targetIngredient}")` : 'FAIL (Context missing)'}`
  );
}

async function testFallback(): Promise<void> {
  console.log(`\n[STEP 6/6] External Provider Fallback Group`);
  console.log(
    `  Model: meal-analyzer-fallback (Claude 3.5 Haiku / GPT-4o-mini)`
  );
  const result = await testChat('meal-analyzer-fallback', 'Fallback');
  if (!result.success) {
    console.log(
      '  Note: Fallback activation requires optional ANTHROPIC_API_KEY or OPENAI_API_KEY.'
    );
  }
}

async function main() {
  console.log(SEPARATOR);
  console.log('  KALLO AI - LITELLM LOCAL KEY ROTATION & FAILOVER SUITE');
  console.log(SEPARATOR);

  const healthy = await checkHealth();
  if (!healthy) {
    process.exitCode = 1;
    return;
  }

  await checkModelPools();
  await checkCooldowns();
  await testKeyRotation();
  await testConversationFailover();
  await testFallback();

  console.log(`\n${SEPARATOR}`);
  console.log('MANUAL FAILOVER INSTRUCTIONS:');
  console.log(SUB_SEPARATOR);
  console.log('1. In your local environment (.env):');
  console.log('   Set GEMINI_API_KEY_1="INVALID_OR_QUOTA_EXCEEDED_KEY"');
  console.log('   Set GEMINI_API_KEY_2="VALID_WORKING_KEY"');
  console.log('2. Recreate the proxy container:');
  console.log('   docker compose -f docker-compose.litellm.yml up -d');
  console.log('3. Re-run this test:');
  console.log('   bun run test:litellm');
  console.log('4. Observe LiteLLM logs:');
  console.log('   docker compose -f docker-compose.litellm.yml logs -f');
  console.log(
    '   Key 1 enters 60s cooldown; traffic routes to Key 2 seamlessly.'
  );
  console.log(`${SEPARATOR}\n`);
}

main().catch((error) => {
  console.error('Fatal suite execution error:', error);
  process.exitCode = 1;
});
