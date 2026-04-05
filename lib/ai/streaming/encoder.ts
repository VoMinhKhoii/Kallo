import type { StreamEvent } from './types';

/**
 * Encode a StreamEvent as an SSE-formatted string.
 *
 * Format: `event: <type>\ndata: <json>\n\n`
 *
 * Uses the event's `type` field as the SSE event name for
 * targeted `EventSource.addEventListener()` on the client.
 */
export function encodeSSE(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Parse a raw SSE text chunk into StreamEvent objects.
 *
 * Handles:
 * - Multiple events per chunk
 * - Split events across chunks (via buffer parameter)
 * - Events without `event:` field (ignored)
 * - Blank lines / keep-alive comments
 */
export function parseSSEChunk(
  chunk: string,
  buffer: { current: string }
): StreamEvent[] {
  buffer.current += chunk;
  const events: StreamEvent[] = [];

  // SSE events are separated by double newlines
  const parts = buffer.current.split('\n\n');

  // Last part may be incomplete — keep it in the buffer
  buffer.current = parts.pop() ?? '';

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Extract data line(s)
    let data = '';
    for (const line of trimmed.split('\n')) {
      if (line.startsWith('data: ')) {
        data += line.slice(6);
      } else if (line.startsWith('data:')) {
        data += line.slice(5);
      }
    }

    if (!data) continue;

    try {
      events.push(JSON.parse(data) as StreamEvent);
    } catch {
      // Malformed JSON — skip this event
      console.warn('[sse] Failed to parse SSE data:', data);
    }
  }

  return events;
}
