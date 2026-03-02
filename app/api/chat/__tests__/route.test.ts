import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
}));

const { POST } = await import('@/app/api/chat/route');

function createRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('POST /api/chat', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    mockGenerateContent.mockReset();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.GEMINI_API_KEY = originalEnv;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  });

  it('returns 500 when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await POST(createRequest({ message: 'test' }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('GEMINI_API_KEY is not configured');
  });

  it('returns 400 when message is missing', async () => {
    const res = await POST(createRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Message is required');
  });

  it('returns 400 when message is not a string', async () => {
    const res = await POST(createRequest({ message: 123 }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Message is required');
  });

  it('returns parsed meal on success', async () => {
    const mockMeal = {
      mealName: 'Phở bò',
      items: [
        {
          id: 'item-1',
          name: 'Phở bò tái',
          quantity: 1,
          unit: 'phần',
          macros: {
            calories: 450,
            protein: 25,
            carbs: 50,
            fat: 15,
          },
        },
      ],
      totalMacros: {
        calories: 450,
        protein: 25,
        carbs: 50,
        fat: 15,
      },
    };

    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(mockMeal),
    });

    const res = await POST(createRequest({ message: 'Phở bò tái' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.mealName).toBe('Phở bò');
    expect(json.items).toHaveLength(1);
    expect(json.totalMacros.calories).toBe(450);
  });

  it('returns 429 on rate limit errors', async () => {
    mockGenerateContent.mockRejectedValue(new Error('429 Too Many Requests'));

    const res = await POST(createRequest({ message: 'test' }));
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toContain('Rate limited');
  });

  it('returns 500 on generic API errors', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Service unavailable'));

    const res = await POST(createRequest({ message: 'test' }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to process meal');
  });
});
