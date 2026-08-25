import { describe, expect, it } from 'vitest';
import { routingConfig } from '../config';

describe('locale routing', () => {
  it('leaves alternate metadata to pages and the sitemap', () => {
    expect(routingConfig.alternateLinks).toBe(false);
  });
});
