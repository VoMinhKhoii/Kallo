import type { ZodType } from 'zod';
import { z } from 'zod';

/**
 * The building blocks every path file uses.
 *
 * OpenAPI 3.1 *is* JSON Schema 2020-12, which is why `fromZod` can hand a
 * contract schema straight through with no adapter library: the request shapes
 * the routes already validate against become the documented request shapes, and
 * the two cannot drift apart because there is only one of them.
 */

export type JsonSchema = Record<string, unknown>;

export interface Parameter {
  name: string;
  in: 'query' | 'path';
  required?: boolean;
  description: string;
  schema: JsonSchema;
}

export interface Operation {
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  parameters?: Parameter[];
  requestBody?: JsonSchema;
  responses: JsonSchema;
  security?: JsonSchema[];
  'x-internal'?: boolean;
}

export type PathItem = Partial<
  Record<'get' | 'post' | 'put' | 'patch' | 'delete', Operation>
>;

/** A zod contract as an inline JSON Schema, minus the `$schema` preamble. */
export function fromZod(schema: ZodType): JsonSchema {
  const { $schema, ...rest } = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    io: 'input',
  }) as JsonSchema & { $schema?: string };
  return rest;
}

export const ref = (name: string): JsonSchema => ({
  $ref: `#/components/schemas/${name}`,
});

const errorResponse = (description: string): JsonSchema => ({
  description,
  content: { 'application/json': { schema: ref('Error') } },
});

/**
 * The error statuses every route can produce.
 *
 * Attached centrally rather than per operation because they come from shared
 * machinery — `handleRouteError` maps a ZodError to 400 and `serializeError`
 * maps an AppError to its status — so an operation that omitted one would be
 * documenting a difference that does not exist.
 */
const COMMON_ERRORS: JsonSchema = {
  '400': errorResponse('Request validation failed (`VALIDATION_FAILED`).'),
  '429': errorResponse(
    'Rate limited (`RATE_LIMITED`). Carries a `Retry-After` header when a wait is known.'
  ),
  '500': errorResponse('Unhandled server error (`INTERNAL`).'),
};

/**
 * The 413 a bounded-body route can produce. Not in COMMON_ERRORS: only the
 * handful of routes that read a request body through `readBoundedBody` can
 * answer it, and documenting it on the rest would describe a response they
 * cannot give.
 */
export const PAYLOAD_TOO_LARGE_ERROR: JsonSchema = {
  '413': errorResponse(
    'Request body exceeded the route’s byte cap (`PAYLOAD_TOO_LARGE`). Not retryable — send less.'
  ),
};

const AUTH_ERRORS: JsonSchema = {
  '401': errorResponse('No valid session (`NOT_AUTHENTICATED`).'),
  '402': errorResponse(
    'The plan does not include this feature (`feature_locked`).'
  ),
  '404': errorResponse('No such resource, or it is not yours (`NOT_FOUND`).'),
};

const INTERNAL_NOTE =
  'First-party endpoint: it exists to serve the Kallo web and mobile clients and is not a stability contract for third parties. It may change without a version bump.';

interface OperationInput {
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  parameters?: Parameter[];
  /** Request body schema — usually `fromZod(someContract)`. */
  body?: JsonSchema;
  bodyDescription?: string;
  /** Media type of the request body. Defaults to `application/json`. */
  bodyMedia?: string;
  /** Success response schema. */
  ok: JsonSchema;
  okStatus?: '200' | '201' | '204' | '302' | '307';
  okDescription?: string;
  /** Media type of the success response. Defaults to `application/json`. */
  okMedia?: string;
  /** Extra documented failures, e.g. `PAYLOAD_TOO_LARGE_ERROR`. */
  extraErrors?: JsonSchema;
}

function build(input: OperationInput, authenticated: boolean): Operation {
  const status = input.okStatus ?? '200';
  const responses: JsonSchema = {
    [status]: {
      description: input.okDescription ?? 'Success.',
      ...(status === '204' || status === '302' || status === '307'
        ? {}
        : {
            content: {
              [input.okMedia ?? 'application/json']: { schema: input.ok },
            },
          }),
    },
    ...COMMON_ERRORS,
    ...(authenticated ? AUTH_ERRORS : {}),
    ...(input.extraErrors ?? {}),
  };

  return {
    operationId: input.operationId,
    summary: input.summary,
    description: authenticated
      ? `${input.description}\n\n${INTERNAL_NOTE}`
      : input.description,
    tags: input.tags,
    ...(input.parameters ? { parameters: input.parameters } : {}),
    ...(input.body
      ? {
          requestBody: {
            required: true,
            description: input.bodyDescription,
            content: {
              [input.bodyMedia ?? 'application/json']: { schema: input.body },
            },
          },
        }
      : {}),
    responses,
    ...(authenticated
      ? { security: [{ supabaseBearer: [] }], 'x-internal': true }
      : { security: [] }),
  };
}

/** An operation requiring a Supabase user JWT. */
export const authed = (input: OperationInput): Operation => build(input, true);

/** An operation callable with no credentials at all. */
export const open = (input: OperationInput): Operation => build(input, false);

// --- Reusable parameters -----------------------------------------------------
// The same three query parameters appear on most read endpoints. Declaring them
// once keeps their descriptions identical everywhere, which is the difference
// between a spec an agent can generalise from and one it has to re-read per
// operation.

export const dateParam: Parameter = {
  name: 'date',
  in: 'query',
  required: true,
  description:
    "The calendar day to read, `YYYY-MM-DD`, in the user's own timezone.",
  schema: { type: 'string', format: 'date' },
};

export const tzParam: Parameter = {
  name: 'tz',
  in: 'query',
  required: false,
  description:
    "Timezone offset in minutes, as JavaScript's `Date.getTimezoneOffset()` reports it (UTC minus local). Omit to use the stored profile timezone.",
  schema: { type: 'integer', minimum: -840, maximum: 840 },
};

export const limitParam = (max: number, note: string): Parameter => ({
  name: 'limit',
  in: 'query',
  required: false,
  description: note,
  schema: { type: 'integer', minimum: 1, maximum: max },
});

export const pathParam = (name: string, description: string): Parameter => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string' },
});
