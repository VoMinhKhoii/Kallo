import { describe, expect, it } from 'vitest';
import { findElement } from '../screen.mjs';

const frame = (x: number, y: number, width = 80, height = 40) => ({
  x,
  y,
  width,
  height,
});

// Shapes taken from `idb ui describe-all` on the dev app's settings and
// sign-in screens.
const elements = [
  { type: 'Application', AXLabel: 'Kallo', frame: frame(0, 0, 440, 956) },
  { type: 'Image', AXLabel: 'Kallo', frame: frame(12, 71, 69, 26) },
  {
    type: 'StaticText',
    AXLabel: 'Sign out of Kallo?',
    frame: frame(40, 420, 360, 26),
  },
  { type: 'Button', AXLabel: 'Sign out\nSign out', frame: frame(40, 465) },
  { type: 'StaticText', AXLabel: 'Privacy policy', frame: frame(0, 0, 0, 0) },
  {
    type: 'TextField',
    AXLabel: null,
    AXValue: 'you@example.com',
    frame: frame(24, 239, 392, 40),
  },
  {
    type: 'TextField',
    AXLabel: null,
    AXValue: '',
    frame: frame(24, 328, 344, 40),
  },
];

describe('findElement', () => {
  it('matches one line of a multi-line control label', () => {
    expect(findElement(elements, { label: 'Sign out' })).toEqual({
      element: elements[3],
      center: { x: 80, y: 485 },
    });
  });

  it('never matches the application or an off-screen element', () => {
    expect(findElement(elements, { label: 'Kallo' })?.element.type).toBe(
      'Image'
    );
    expect(findElement(elements, { label: 'Privacy policy' })).toBeNull();
  });

  it('does not match a label by substring', () => {
    expect(findElement(elements, { label: 'Sign' })).toBeNull();
  });

  it('finds a field by its placeholder, and again by position once typed into', () => {
    expect(findElement(elements, { label: 'you@example.com' })?.center).toEqual(
      { x: 220, y: 259 }
    );
    expect(findElement(elements, { at: { x: 196, y: 348 } })?.element).toBe(
      elements[6]
    );
    expect(findElement(elements, { at: { x: 5, y: 5 } })).toBeNull();
  });

  it('prefers a control over static text with the same label', () => {
    const both = [
      { type: 'StaticText', AXLabel: 'Continue', frame: frame(0, 100) },
      { type: 'Button', AXLabel: 'Continue', frame: frame(0, 200) },
    ];
    expect(findElement(both, { label: 'Continue' })?.element.type).toBe(
      'Button'
    );
  });
});
