import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import {
  HTTP_METHODS,
  handlerSources,
  toSpecPath,
  walkRoutes,
} from '@/lib/api/openapi/__tests__/route-files';
import {
  fromZod,
  type JsonSchema,
  type Operation,
  type Parameter,
  type PathItem,
} from '@/lib/api/openapi/components';
import { openApiDocument } from '@/lib/api/openapi/document';

/**
 * `drift.test.ts` proves every route is documented. This proves the
 * documentation is TRUE — the three kinds of drift the 2026-09 pentest found
 * (KALLO-09) in a spec that passed the existence check:
 *
 *  1. Request bodies. Where a route parses its JSON body with a Zod contract,
 *     the documented body must have the same property names and the same
 *     required keys. (The spec advertised `{ userId }` for a route that read
 *     `memberUserIds`.)
 *  2. Success statuses. Every documented 2xx/3xx must be one the handler can
 *     return. (Sixteen operations advertised a 201 no route ever sends.)
 *  3. Query parameters. The documented names must be exactly the ones the
 *     handler reads, and a `tz` the handler rejects when missing must be
 *     documented as required.
 *
 * All three read the route source rather than an explicit table, so a new
 * route is covered the day it is added, with nothing to remember to update.
 */

const doc = openApiDocument();
const paths = doc.paths as Record<string, PathItem>;

const routeFileByPath = new Map(
  walkRoutes().map((file) => [toSpecPath(file), file])
);

interface DocumentedOperation {
  where: string;
  op: Operation;
  source: string;
  handler: string;
  file: string;
}

const operations: DocumentedOperation[] = Object.entries(paths).flatMap(
  ([specPath, item]) => {
    const file = routeFileByPath.get(specPath);
    if (!file) return []; // drift.test.ts reports the missing route.
    const source = readFileSync(file, 'utf8');
    const handlers = handlerSources(source);
    return HTTP_METHODS.flatMap((method) => {
      const op = item[method];
      const handler = handlers.get(method);
      if (!op || !handler) return [];
      const where = `${method.toUpperCase()} ${specPath}`;
      return [{ where, op, source, handler, file }];
    });
  }
);

// --- 1. Request bodies ------------------------------------------------------

/** `fooSchema.parse(await req.json())`, `readJsonBody(...)`, `readBoundedJson(...)`. */
const BODY_PARSE_RE =
  /(\w+)\.(?:safeParse|parse)\(\s*await\s+(?:\w+\.json\(\)|readJsonBody\(|readBoundedJson\()/;

/**
 * Routes that validate their body outside the route file, named with the file
 * that does it. The test still checks that file really parses with it.
 */
const BODY_PARSED_ELSEWHERE: Record<string, { schema: string; in: string }> = {
  'POST /api/analyze-meal': {
    schema: 'mealMessageSchema',
    in: 'app/api/analyze-meal/_lib/request-validation.ts',
  },
};

/**
 * Operations whose JSON body is still hand-written in the spec because the
 * route casts `readJsonBody()` and leaves validation to the action it calls.
 * A ratchet: shrink it as routes gain a boundary contract; a NEW route with an
 * uncontracted body fails until it has one (or is added here, in review).
 */
const HAND_WRITTEN_BODIES = new Set([
  'PATCH /api/v1/chat-groups/{groupId}',
  'POST /api/v1/chat-groups/{groupId}/messages',
  'POST /api/v1/groups/friends/block',
  'DELETE /api/v1/groups/friends/remove',
  'POST /api/v1/groups/invite/accept',
  'POST /api/v1/groups/invites/accept',
  'POST /api/v1/groups/invites/accept-cheat',
  'POST /api/v1/groups/invites/dismiss',
  'POST /api/v1/groups/meal-share',
  'POST /api/v1/groups/profile',
  'POST /api/v1/groups/profile/name',
  'POST /api/v1/groups/shares',
  'POST /api/v1/groups/shares/log',
  'POST /api/v1/groups/shares/reaction',
  'POST /api/v1/groups/shares/reply',
]);

/** Where the route imports `name` from, e.g. `@/lib/api/contracts/meals`. */
function importSource(source: string, name: string): string | undefined {
  for (const match of source.matchAll(
    /import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g
  )) {
    const names = match[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]);
    if (names.includes(name)) return match[2];
  }
  return undefined;
}

function jsonBody(op: Operation): JsonSchema | undefined {
  const content = (op.requestBody as { content?: Record<string, JsonSchema> })
    ?.content;
  return content?.['application/json']?.schema as JsonSchema | undefined;
}

const shape = (schema: JsonSchema | undefined) => ({
  properties: Object.keys(
    (schema?.properties as Record<string, unknown>) ?? {}
  ).sort(),
  required: [...((schema?.required as string[]) ?? [])].sort(),
});

async function contractFor(
  entry: DocumentedOperation
): Promise<{ name: string; schema: ZodType } | undefined> {
  const elsewhere = BODY_PARSED_ELSEWHERE[entry.where];
  let name: string | undefined;
  let lookIn: string;
  if (elsewhere) {
    name = elsewhere.schema;
    lookIn = readFileSync(path.join(process.cwd(), elsewhere.in), 'utf8');
    expect(lookIn, `${elsewhere.in} parses ${name}`).toMatch(
      new RegExp(`${name}\\.(?:safeParse|parse)\\(`)
    );
  } else {
    name = entry.handler.match(BODY_PARSE_RE)?.[1];
    lookIn = entry.source;
  }
  if (!name) return undefined;
  const from = importSource(lookIn, name) ?? '';
  expect(from, `${entry.where}: import of ${name}`).not.toBe('');
  const mod = (await import(from)) as Record<string, ZodType>;
  expect(mod[name], `${from} exports ${name}`).toBeDefined();
  return { name, schema: mod[name] };
}

describe('documented request bodies match the route’s Zod contract', () => {
  it('uses the same property names and required keys', async () => {
    const mismatched: string[] = [];
    let checked = 0;
    for (const entry of operations) {
      const contract = await contractFor(entry);
      if (!contract) continue;
      checked += 1;
      const documented = shape(jsonBody(entry.op));
      const actual = shape(fromZod(contract.schema));
      if (JSON.stringify(documented) !== JSON.stringify(actual)) {
        mismatched.push(
          `${entry.where}: spec ${JSON.stringify(documented)} ≠ ${contract.name} ${JSON.stringify(actual)}`
        );
      }
    }
    // A broken regex would make the loop vacuously pass.
    expect(checked).toBeGreaterThan(20);
    expect(mismatched).toEqual([]);
  });

  it('has a contract behind every JSON body, bar the listed hand-written ones', async () => {
    const uncontracted: string[] = [];
    for (const entry of operations) {
      if (!jsonBody(entry.op)) continue;
      if (await contractFor(entry)) continue;
      if (!HAND_WRITTEN_BODIES.has(entry.where)) uncontracted.push(entry.where);
    }
    expect(uncontracted).toEqual([]);
  });

  it('lists no hand-written body that now has a contract, or no body at all', async () => {
    const stale: string[] = [];
    const byWhere = new Map(operations.map((entry) => [entry.where, entry]));
    for (const where of HAND_WRITTEN_BODIES) {
      const entry = byWhere.get(where);
      if (!entry || !jsonBody(entry.op) || (await contractFor(entry))) {
        stale.push(where);
      }
    }
    expect(stale).toEqual([]);
  });
});

// --- 2. Success statuses ----------------------------------------------------

/**
 * Every success status a handler's source can produce. A `Response.json`,
 * `NextResponse.json`, `new Response` or `new ImageResponse` defaults to 200;
 * `NextResponse.redirect` to 307; an explicit `status: NNN` adds NNN. A handler
 * that builds its response in a helper falls back to the whole file.
 */
function returnableStatuses(handler: string, source: string): Set<number> {
  const scan = (text: string) => {
    const found = new Set<number>();
    if (
      /(?:Response|NextResponse)\.json\(|new\s+(?:Response|ImageResponse)\(/.test(
        text
      )
    ) {
      found.add(200);
    }
    if (/NextResponse\.redirect\(/.test(text)) found.add(307);
    for (const match of text.matchAll(/status:\s*(\d{3})\b/g)) {
      found.add(Number(match[1]));
    }
    return found;
  };
  const own = scan(handler);
  return own.size > 0 ? own : scan(source);
}

describe('documented success statuses are ones the handler returns', () => {
  it('documents no 2xx/3xx the route cannot send', () => {
    const impossible: string[] = [];
    for (const { where, op, handler, source } of operations) {
      const possible = returnableStatuses(handler, source);
      for (const code of Object.keys(op.responses)) {
        if (!/^[23]\d\d$/.test(code)) continue;
        if (!possible.has(Number(code))) {
          impossible.push(
            `${where}: documents ${code}, handler returns ${[...possible].join('/') || 'nothing detectable'}`
          );
        }
      }
    }
    expect(operations.length).toBeGreaterThan(70);
    expect(impossible).toEqual([]);
  });
});

// --- 3. Query parameters ----------------------------------------------------

const readQueryNames = (handler: string) =>
  new Set(
    [
      ...handler.matchAll(/(?:searchParams|params)\.get\(\s*'([^']+)'\s*\)/g),
    ].map((match) => match[1])
  );

const documentedQuery = (op: Operation): Parameter[] =>
  (op.parameters ?? []).filter((parameter) => parameter.in === 'query');

describe('documented query parameters match what the handler reads', () => {
  it('documents exactly the query names the handler reads', () => {
    const drift: string[] = [];
    for (const { where, op, handler } of operations) {
      const read = readQueryNames(handler);
      const documented = new Set(documentedQuery(op).map((p) => p.name));
      for (const name of read) {
        if (!documented.has(name))
          drift.push(`${where}: reads ?${name}, undocumented`);
      }
      for (const name of documented) {
        if (!read.has(name))
          drift.push(`${where}: documents ?${name}, never read`);
      }
    }
    expect(drift).toEqual([]);
  });

  it('marks `tz` required wherever a missing value is a 400', () => {
    // `parseTzParam` turns a missing `tz` into null precisely so the schema
    // rejects it — the route has no stored-timezone fallback.
    const wrong: string[] = [];
    for (const { where, op, handler } of operations) {
      if (!handler.includes('parseTzParam(')) continue;
      const tz = documentedQuery(op).find((p) => p.name === 'tz');
      if (!tz?.required) wrong.push(where);
    }
    expect(wrong).toEqual([]);
  });
});
