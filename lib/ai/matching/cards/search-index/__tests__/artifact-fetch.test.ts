import { afterEach, describe, expect, it, vi } from 'vitest';
import { readArtifactFile } from '../artifact-fetch.mjs';

afterEach(() => vi.unstubAllGlobals());

/** A fetch that answers the metadata server and storage in turn. */
function stubFetch(
  answer: (url: string) => Response | Promise<Response> | never
) {
  const fetch = vi.fn(async (url: string) => answer(url));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const GS = 'gs://kallo-prod-card-search/f1/build-1';

// Every failure names its file and step: the first prod load failed with a
// bare "The operation was aborted due to timeout" that said neither.
describe('readArtifactFile failures', () => {
  it('names the metadata token step when the token fetch fails', async () => {
    stubFetch(() => {
      throw new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError'
      );
    });
    await expect(readArtifactFile(GS, 'manifest.json', 1_000)).rejects.toThrow(
      'card index: manifest.json: metadata token: The operation was aborted due to timeout'
    );
  });

  it('names the file when storage refuses it', async () => {
    stubFetch((url) =>
      url.startsWith('http://metadata')
        ? Response.json({ access_token: 't', expires_in: 3600 })
        : new Response('', { status: 403 })
    );
    await expect(readArtifactFile(GS, 'texts.f16', 1_000)).rejects.toThrow(
      'card index: texts.f16: HTTP 403'
    );
  });

  it('names the file when a local copy is missing', async () => {
    await expect(
      readArtifactFile('file:///no/such/build', 'catalog.json', 1_000)
    ).rejects.toThrow(/^card index: catalog\.json: .*ENOENT/);
  });
});
