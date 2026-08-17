import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function hasSmokeCheckPrerequisite(): { enabled: boolean; reason?: string } {
  if (process.platform === 'win32') {
    return {
      enabled: false,
      reason: 'smoke-check runs via bash and is skipped on Windows workspaces.',
    };
  }

  return { enabled: true };
}

const smokeCheckPrerequisite = hasSmokeCheckPrerequisite();
const describeSmokeCheck = smokeCheckPrerequisite.enabled
  ? describe
  : describe.skip;

type RequestHandler = (
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>
) => void;

async function runSmokeCheck(baseUrl: string) {
  const child = spawn(
    'bash',
    [resolve('scripts/cloud-run/smoke-check.sh'), baseUrl],
    {
      stdio: 'pipe',
    }
  );

  const [code] = (await once(child, 'close')) as [number | null];

  return code;
}

async function withServer(
  handler: RequestHandler,
  run: (baseUrl: string) => Promise<void>
) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Expected a TCP server address.');
  }

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

describeSmokeCheck('smoke-check.sh', () => {
  it('passes for healthy services with /api/healthz', async () => {
    await withServer(
      (request, response) => {
        if (request.url === '/api/healthz') {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end('{"ok":true,"service":"kallo"}');
          return;
        }

        if (request.url === '/en') {
          response.writeHead(200);
          response.end('ok');
          return;
        }

        response.writeHead(404);
        response.end('missing');
      },
      async (baseUrl) => {
        expect(await runSmokeCheck(baseUrl)).toBe(0);
      }
    );
  });

  it('falls back to /en when /api/healthz is missing on legacy images', async () => {
    await withServer(
      (request, response) => {
        if (request.url === '/api/healthz') {
          response.writeHead(404);
          response.end('missing');
          return;
        }

        if (request.url === '/en') {
          response.writeHead(200);
          response.end('ok');
          return;
        }

        response.writeHead(404);
        response.end('missing');
      },
      async (baseUrl) => {
        expect(await runSmokeCheck(baseUrl)).toBe(0);
      }
    );
  });

  it('fails when /api/healthz reports unhealthy state', async () => {
    await withServer(
      (request, response) => {
        if (request.url === '/api/healthz') {
          response.writeHead(503, { 'content-type': 'application/json' });
          response.end('{"ok":false,"service":"kallo"}');
          return;
        }

        if (request.url === '/en') {
          response.writeHead(200);
          response.end('ok');
          return;
        }

        response.writeHead(404);
        response.end('missing');
      },
      async (baseUrl) => {
        expect(await runSmokeCheck(baseUrl)).toBe(1);
      }
    );
  }, 15000);
});
