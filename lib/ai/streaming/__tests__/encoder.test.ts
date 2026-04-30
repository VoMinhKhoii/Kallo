import { describe, expect, it } from 'vitest';
import { encodeSSE, parseSSEChunk } from '../encoder';
import type { StreamEvent } from '../types';

describe('encodeSSE', () => {
  it('formats a stage event as SSE text', () => {
    const event: StreamEvent = { type: 'stage', stage: 'decomposing' };
    const encoded = encodeSSE(event);

    expect(encoded).toBe(
      'event: stage\ndata: {"type":"stage","stage":"decomposing"}\n\n'
    );
  });

  it('formats an item_name event', () => {
    const event: StreamEvent = {
      type: 'item_name',
      name: 'Phở bò',
      index: 0,
      mealItemId: '11111111-1111-1111-1111-111111111111',
    };
    const encoded = encodeSSE(event);

    expect(encoded).toContain('event: item_name\n');
    expect(encoded).toContain('"name":"Phở bò"');
    expect(encoded).toContain('"index":0');
    expect(encoded.endsWith('\n\n')).toBe(true);
  });

  it('formats an item_macros event', () => {
    const event: StreamEvent = {
      type: 'item_macros',
      mealItemId: '22222222-2222-2222-2222-222222222222',
      item: {
        id: 'item-1',
        name: 'Cơm trắng',
        quantity: 200,
        unit: 'g',
        macros: { calories: 260, protein: 5, carbs: 57, fat: 1 },
      },
    };
    const encoded = encodeSSE(event);

    expect(encoded).toContain('event: item_macros\n');
    expect(encoded).toContain('"name":"Cơm trắng"');
    expect(encoded.endsWith('\n\n')).toBe(true);
  });

  it('formats an error event with all fields', () => {
    const event: StreamEvent = {
      type: 'error',
      code: 'rate_limit',
      message: 'Too many requests',
      retryable: true,
    };
    const encoded = encodeSSE(event);

    expect(encoded).toContain('event: error\n');
    const parsed = JSON.parse(encoded.split('data: ')[1].trim());
    expect(parsed).toEqual(event);
  });

  it('formats analysis_complete with analysisId', () => {
    const event: StreamEvent = {
      type: 'analysis_complete',
      analysisId: 'abc-123',
    };
    const encoded = encodeSSE(event);

    expect(encoded).toContain('event: analysis_complete\n');
    expect(encoded).toContain('"analysisId":"abc-123"');
  });
});

describe('parseSSEChunk', () => {
  it('parses a single complete event', () => {
    const buffer = { current: '' };
    const chunk = 'event: stage\ndata: {"type":"stage","stage":"matching"}\n\n';

    const events = parseSSEChunk(chunk, buffer);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'stage', stage: 'matching' });
    expect(buffer.current).toBe('');
  });

  it('parses multiple events in one chunk', () => {
    const buffer = { current: '' };
    const chunk =
      'event: stage\ndata: {"type":"stage","stage":"decomposing"}\n\n' +
      'event: item_name\ndata: {"type":"item_name","name":"Cơm","index":0}\n\n';

    const events = parseSSEChunk(chunk, buffer);

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'stage', stage: 'decomposing' });
    expect(events[1]).toEqual({ type: 'item_name', name: 'Cơm', index: 0 });
  });

  it('handles split events across chunks', () => {
    const buffer = { current: '' };

    // First chunk — incomplete event
    const events1 = parseSSEChunk(
      'event: stage\ndata: {"type":"stage",',
      buffer
    );
    expect(events1).toHaveLength(0);
    expect(buffer.current).not.toBe('');

    // Second chunk — completes the event
    const events2 = parseSSEChunk('"stage":"estimating"}\n\n', buffer);
    expect(events2).toHaveLength(1);
    expect(events2[0]).toEqual({ type: 'stage', stage: 'estimating' });
  });

  it('skips malformed JSON without throwing', () => {
    const buffer = { current: '' };
    const chunk = 'event: stage\ndata: {broken json}\n\n';

    const events = parseSSEChunk(chunk, buffer);

    expect(events).toHaveLength(0);
  });

  it('skips events without data lines', () => {
    const buffer = { current: '' };
    const chunk = 'event: keepalive\n\n';

    const events = parseSSEChunk(chunk, buffer);

    expect(events).toHaveLength(0);
  });

  it('handles Vietnamese text with diacritics', () => {
    const buffer = { current: '' };
    const chunk =
      'event: item_name\ndata: {"type":"item_name","name":"Bún bò Huế","index":0}\n\n';

    const events = parseSSEChunk(chunk, buffer);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'item_name',
      name: 'Bún bò Huế',
      index: 0,
    });
  });

  it('roundtrips through encode → parse', () => {
    const buffer = { current: '' };
    const original: StreamEvent = {
      type: 'error',
      code: 'internal',
      message: 'Something went wrong',
      retryable: false,
    };

    const encoded = encodeSSE(original);
    const [parsed] = parseSSEChunk(encoded, buffer);

    expect(parsed).toEqual(original);
  });
});
