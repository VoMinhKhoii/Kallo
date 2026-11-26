import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Painting } from '../painting';

describe('Painting', () => {
  it('gives crawlers a small src while browsers keep every srcSet width', () => {
    const { container } = render(<Painting name="stacks-of-wheat" eager />);
    const img = container.querySelector('img');

    expect(img?.getAttribute('src')).toBe(
      '/_next/image?url=%2Flanding%2Fhero%2Fstacks-of-wheat.webp&w=828&q=75'
    );
    expect(img?.getAttribute('srcset')).toContain('w=3840&q=75 3840w');
  });
});
