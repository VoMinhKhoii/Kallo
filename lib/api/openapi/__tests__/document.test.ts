import { describe, expect, it } from 'vitest';
import type { Operation, PathItem } from '@/lib/api/openapi/components';
import { openApiDocument } from '@/lib/api/openapi/document';

const doc = openApiDocument();
const paths = doc.paths as Record<string, PathItem>;

function everyOperation(): Array<{
  path: string;
  method: string;
  op: Operation;
}> {
  const out: Array<{ path: string; method: string; op: Operation }> = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (op) out.push({ path, method, op: op as Operation });
    }
  }
  return out;
}

describe('the published OpenAPI document', () => {
  it('is OpenAPI 3.1', () => {
    expect(doc.openapi).toBe('3.1.0');
  });

  it('serializes to JSON without cycles or undefined', () => {
    const round = JSON.parse(JSON.stringify(doc));
    expect(round.paths).toBeDefined();
    expect(Object.keys(round.paths).length).toBeGreaterThan(50);
  });

  it('gives every operation a unique operationId', () => {
    // Function-calling tools key on operationId; a duplicate silently shadows.
    const ids = everyOperation().map(({ op }) => op.operationId);
    const seen = new Map<string, number>();
    for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1)).toEqual([]);
    expect(ids.every((id) => /^[a-z][A-Za-z0-9]*$/.test(id))).toBe(true);
  });

  it('describes every operation', () => {
    for (const { path, method, op } of everyOperation()) {
      const where = `${method.toUpperCase()} ${path}`;
      expect(op.summary, where).toBeTruthy();
      expect(op.description, where).toBeTruthy();
      expect(op.description.length, where).toBeGreaterThan(30);
      expect(op.tags.length, where).toBeGreaterThan(0);
    }
  });

  it('gives every operation a success response and the shared error responses', () => {
    for (const { path, method, op } of everyOperation()) {
      const where = `${method.toUpperCase()} ${path}`;
      const codes = Object.keys(op.responses);
      expect(
        codes.some((code) => code.startsWith('2') || code === '302'),
        where
      ).toBe(true);
      for (const code of ['400', '429', '500']) {
        expect(codes, where).toContain(code);
      }
    }
  });

  it('types every parameter', () => {
    for (const { path, method, op } of everyOperation()) {
      for (const parameter of op.parameters ?? []) {
        const where = `${method.toUpperCase()} ${path} ?${parameter.name}`;
        expect(parameter.description, where).toBeTruthy();
        expect(parameter.schema, where).toBeTruthy();
        expect(['query', 'path'], where).toContain(parameter.in);
      }
    }
  });

  it('marks authenticated operations as first-party and unauthenticated ones as public', () => {
    for (const { path, method, op } of everyOperation()) {
      const where = `${method.toUpperCase()} ${path}`;
      if (op['x-internal']) {
        expect(op.security, where).toEqual([{ supabaseBearer: [] }]);
        expect(op.description, where).toContain('First-party endpoint');
        expect(Object.keys(op.responses), where).toContain('401');
      } else {
        expect(op.security, where).toEqual([]);
        expect(op.tags, where).toContain('Public');
      }
    }
  });

  it('declares a bearer scheme with no scopes', () => {
    // Supabase tokens carry none. Declaring scopes nothing enforces would be a
    // claim a machine could act on — see the protected-resource metadata.
    const schemes = (
      doc.components as { securitySchemes: Record<string, unknown> }
    ).securitySchemes;
    expect(schemes.supabaseBearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    // No `flows`/`scopes` key anywhere: those belong to an oauth2 scheme, and
    // declaring one here would advertise a scope model that does not exist.
    expect(schemes.supabaseBearer).not.toHaveProperty('flows');
    for (const { op } of everyOperation()) {
      for (const requirement of op.security ?? []) {
        expect(Object.values(requirement)).toEqual(
          Object.values(requirement).map(() => [])
        );
      }
    }
  });

  it('resolves every $ref against a declared schema', () => {
    const schemas = (doc.components as { schemas: Record<string, unknown> })
      .schemas;
    const refs = [
      ...JSON.stringify(doc).matchAll(/#\/components\/schemas\/(\w+)/g),
    ].map((m) => m[1]);
    const missing = [...new Set(refs)].filter((name) => !(name in schemas));
    expect(missing).toEqual([]);
  });

  it('names the four public operations', () => {
    const publicIds = everyOperation()
      .filter(({ op }) => !op['x-internal'])
      .map(({ op }) => op.operationId)
      .sort();
    expect(publicIds).toEqual([
      'confirmWaitlist',
      'getHealth',
      'getInvitePreview',
      'joinWaitlist',
    ]);
  });
});
