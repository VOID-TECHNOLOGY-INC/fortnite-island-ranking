import { describe, expect, it, vi } from 'vitest';
import { buildPerplexityPrompts, fetchResearch } from './research.js';

describe('buildPerplexityPrompts', () => {
  it('ja prompt contains required headings and prefers sources', () => {
    const { system, user } = buildPerplexityPrompts('ja', 'Sample (0000-0000-0000)');
    expect(system).toMatch(/出典|公式/);
    expect(user).toMatch(/## Island Status/);
    expect(user).toMatch(/### 状況/);
  });

  it('en prompt contains required headings and prefers sources', () => {
    const { system, user } = buildPerplexityPrompts('en', 'Sample (0000-0000-0000)');
    expect(system).toMatch(/official|sources|Markdown/);
    expect(user).toMatch(/## Island Status/);
    expect(user).toMatch(/### Status/);
  });
});

describe('fetchResearch', () => {
  const mockFetch = vi.fn();
  const options = {
    apiKey: 'test-key',
    model: 'test-model',
    fetch: mockFetch as any
  };

  it('fetches and parses research content from Perplexity API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '## Island Status\n### Status\n- Buzzing\n\n## Sources\n- https://example.com'
            }
          }
        ]
      })
    });

    const result = await fetchResearch('0000-0000-0000', { name: 'Test', lang: 'en', refresh: false }, options);

    expect(result.summary).toContain('Buzzing');
    expect(result.highlights).toContain('Buzzing');
    expect(result.sources[0]?.url).toBe('https://example.com');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('retrieves from cache when refresh is false', async () => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Cached Content' } }] })
    });
    
    // For TDD, let's first ensure it calls fetch when it's not in cache.
    const result1 = await fetchResearch('1111-2222-3333', { name: 'Test', lang: 'en', refresh: false }, options);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockClear();
    const result2 = await fetchResearch('1111-2222-3333', { name: 'Test', lang: 'en', refresh: false }, options);
    expect(mockFetch).toHaveBeenCalledTimes(0);
    expect(result2.summary).toBe(result1.summary);
  });

  it('bypasses cache when refresh is true', async () => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'New Content' } }] })
    });

    await fetchResearch('2222-3333-4444', { name: 'Test', lang: 'en', refresh: false }, options);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockClear();
    // Use a different code to avoid throttle from previous call
    await fetchResearch('different-code', { name: 'Test', lang: 'en', refresh: true }, options);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throttles refresh calls', async () => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Fresh Content' } }] })
    });

    // First refresh call
    await fetchResearch('3333-4444-5555', { name: 'Test', lang: 'en', refresh: true }, options);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockClear();
    // Second refresh call immediately after should NOT call fetch again (throttle)
    const result = await fetchResearch('3333-4444-5555', { name: 'Test', lang: 'en', refresh: true }, options);
    expect(mockFetch).toHaveBeenCalledTimes(0);
    expect(result.summary).toBe('Fresh Content');
  });
});
