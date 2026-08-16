'use client';

import { useRef } from 'react';

/**
 * False until `pending` has gone false, and false for that render too — true
 * only from the render AFTER.
 *
 * The off-by-one render is the point. It is how a component tells "this is the
 * first answer, put things where they belong" apart from "something changed,
 * animate it": the render that delivers the answer is the one that moves
 * everything, so anything reading this flag sits that render out.
 */
export function useSettledOnce(pending: boolean): boolean {
  const settled = useRef(false);
  const wasSettled = settled.current;
  if (!pending) settled.current = true;
  return wasSettled;
}
