import { describe, expect, it } from 'vitest';
import {
  circleGroupHref,
  circleThreadHref,
} from '@/lib/domain/social/circle-routes';

const SHARE_ID = '3f1d2c4b-5a6e-4f70-8b91-0c2d3e4f5a6b';
const GROUP_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('circle routes', () => {
  it('sends a share to the post own page', () => {
    expect(circleThreadHref(SHARE_ID)).toBe(`/circle/${SHARE_ID}`);
  });

  it('sends a group to its feed', () => {
    expect(circleGroupHref(GROUP_ID)).toBe(`/circle/g/${GROUP_ID}`);
  });

  it('keeps the two shapes apart — a group is never a share', () => {
    // `/circle/<id>` and `/circle/g/<id>` are different routes; a helper that
    // let one collapse into the other would open the wrong page.
    expect(circleThreadHref(GROUP_ID)).not.toBe(circleGroupHref(GROUP_ID));
  });

  it('passes UUIDs through untouched — no escaping to undo', () => {
    // Both ids parse as `uuidSchema` before they ever reach a URL, and a UUID
    // is [0-9a-f-] only, so percent-encoding would only ever be noise here.
    expect(circleThreadHref(SHARE_ID)).toBe(
      `/circle/${encodeURIComponent(SHARE_ID)}`
    );
    expect(circleGroupHref(GROUP_ID)).toBe(
      `/circle/g/${encodeURIComponent(GROUP_ID)}`
    );
  });
});
