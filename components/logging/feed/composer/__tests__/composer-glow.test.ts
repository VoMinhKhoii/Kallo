import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every `radial-gradient(...)` declared for `--kallo-composer-glow`, in both the
 * light and the dark palette.
 */
function glowGradients(): { block: string; gradients: string[] }[] {
  const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
  const blocks = css.match(/--kallo-composer-glow:[\s\S]*?\);\n/g) ?? [];
  return blocks.map((block) => ({ block, gradients: splitGradients(block) }));
}

/**
 * The `radial-gradient(...)` calls in `block`, matched by counting parens.
 *
 * A non-greedy regex cannot do this: the first `)` it meets belongs to an
 * `rgba(...)` colour, so every gradient came back truncated at its first stop —
 * which quietly made the containment check below assert about nothing.
 */
function splitGradients(block: string): string[] {
  const found: string[] = [];
  const token = 'radial-gradient(';
  for (
    let i = block.indexOf(token);
    i !== -1;
    i = block.indexOf(token, i + 1)
  ) {
    let depth = 0;
    for (let j = i + token.length - 1; j < block.length; j++) {
      if (block[j] === '(') depth++;
      else if (block[j] === ')' && --depth === 0) {
        found.push(block.slice(i, j + 1));
        break;
      }
    }
  }
  return found;
}

interface Ellipse {
  rx: number;
  ry: number;
  cx: number;
  cy: number;
  /** Position of the outermost colour stop, as a fraction of the radius. */
  outermost: number;
}

function parseEllipse(gradient: string): Ellipse {
  const geometry = gradient.match(
    /radial-gradient\(\s*([\d.]+)%\s+([\d.]+)%\s+at\s+([\d.]+)%\s+([\d.]+)%/
  );
  if (!geometry) throw new Error(`unparsed gradient geometry: ${gradient}`);
  const stops = [...gradient.matchAll(/\)\s+([\d.]+)%/g)].map((m) =>
    Number(m[1])
  );
  return {
    rx: Number(geometry[1]),
    ry: Number(geometry[2]),
    cx: Number(geometry[3]),
    cy: Number(geometry[4]),
    // No explicit final stop means it runs to the full radius.
    outermost: (stops.length ? Math.max(...stops) : 100) / 100,
  };
}

describe('the composer halo', () => {
  it('is declared for both palettes', () => {
    expect(glowGradients()).toHaveLength(2);
  });

  it('fades out inside its own box, on every side', () => {
    // The bug this exists for: a 122% vertical radius centred 74% down
    // overshot the box top by 9% and its bottom by half a box, so the ellipse
    // was cut off and what you saw was a pair of hard horizontal edges across
    // the page instead of light. Percentages are PER AXIS, so each radius plus
    // its offset from centre has to stay on the canvas.
    for (const { gradients } of glowGradients()) {
      expect(gradients.length).toBeGreaterThan(0);
      for (const gradient of gradients) {
        const { rx, ry, cx, cy, outermost } = parseEllipse(gradient);
        const reachX = rx * outermost;
        const reachY = ry * outermost;
        expect(cx - reachX, `left edge of ${gradient}`).toBeGreaterThanOrEqual(
          0
        );
        expect(cx + reachX, `right edge of ${gradient}`).toBeLessThanOrEqual(
          100
        );
        expect(cy - reachY, `top edge of ${gradient}`).toBeGreaterThanOrEqual(
          0
        );
        expect(cy + reachY, `bottom edge of ${gradient}`).toBeLessThanOrEqual(
          100
        );
      }
    }
  });

  it('lands softly rather than stopping at a kink', () => {
    // A two-stop ramp is linear in radius; the corner where it reaches zero
    // reads as a faint ring even though the alpha there is 0.
    for (const { gradients } of glowGradients()) {
      for (const gradient of gradients) {
        const colours = gradient.match(/rgba\(/g) ?? [];
        expect(colours.length, `stops in ${gradient}`).toBeGreaterThanOrEqual(
          3
        );
      }
    }
  });

  it('fades to its own colour, never to bare transparent', () => {
    // `transparent` is transparent BLACK, and some engines interpolate through
    // it — which fringes a warm halo grey against the cream.
    for (const { block } of glowGradients()) {
      expect(block).not.toMatch(/\btransparent\b/);
    }
  });
});
