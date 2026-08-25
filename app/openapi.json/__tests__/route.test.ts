import { describe, expect, it } from 'vitest';
import { GET } from '@/app/openapi.json/route';

describe('/openapi.json', () => {
  it('serves valid JSON with the right content type', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const body = JSON.parse(await response.text());
    expect(body.openapi).toBe('3.1.0');
  });

  it('is readable from a browser-based agent', async () => {
    // A public read-only spec nobody can fetch cross-origin is a spec nobody
    // uses.
    expect(GET().headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('names one server, the production origin', async () => {
    const body = await GET().json();
    expect(body.servers).toEqual([
      { url: 'https://kallo.fit', description: 'Production' },
    ]);
  });

  it('points a reader at the human documentation and a contact', async () => {
    const body = await GET().json();
    expect(body.externalDocs.url).toContain('/docs/developers/api');
    expect(body.info.contact.email).toBe('support@kallo.fit');
    expect(body.info.termsOfService).toContain('/docs/legal/terms');
  });
});
