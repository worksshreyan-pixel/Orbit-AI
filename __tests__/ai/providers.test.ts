import { GeminiProvider } from '../../lib/ai/providers/gemini';
import { OpenRouterProvider } from '../../lib/ai/providers/openrouter';
import { GroqProvider } from '../../lib/ai/providers/groq';
import { ProviderErrorCategory } from '../../lib/ai/types';
import { AI_CONFIG } from '../../lib/ai/config';

// Mock config
jest.mock('../../lib/ai/config', () => ({
  AI_CONFIG: {
    gemini: { apiKey: 'test-gemini', defaultModel: 'gemini-3.7-flash' },
    openrouter: { apiKey: 'test-openrouter', defaultModel: 'openai/gpt-oss-20b' },
    groq: { apiKey: 'test-groq', defaultModel: 'openai/gpt-oss-20b' },
  }
}));

describe('AI Providers', () => {
  const dummyContext = { userId: '1', memories: [], recentTasks: [], observations: [], workingContext: [] };
  
  beforeEach(() => {
    global.fetch = jest.fn();
    process.env.GEMINI_API_KEY = 'test-gemini';
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.GEMINI_API_KEY;
  });

  describe('GeminiProvider', () => {
    const provider = new GeminiProvider();

    it('handles successful generation', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"type":"final","response":"success"}' }] } }]
        })
      });

      const res = await provider.generateResponse('Hello', dummyContext);
      expect(res.response).toBe('success');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('gemini-3.7-flash:generateContent?key=test-gemini'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('categorizes 503 error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ error: { message: 'Service Unavailable' } })
      });

      try {
        await provider.generateResponse('Hello', dummyContext);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.category).toBe(ProviderErrorCategory.NETWORK);
        expect(err.message).toContain('Service Unavailable');
      }
    });

    it('categorizes 400 error as INVALID_REQUEST', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { message: 'Bad Request' } })
      });

      try {
        await provider.generateResponse('Hello', dummyContext);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.category).toBe(ProviderErrorCategory.INVALID_REQUEST);
      }
    });

    it('categorizes network fetch error/timeout as NETWORK', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('fetch failed: timeout'));
      try {
        await provider.generateResponse('Hello', dummyContext);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.category).toBe(ProviderErrorCategory.NETWORK);
      }
    });

    it('redacts API keys from error messages', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: 'Invalid key: test-gemini is not valid' } })
      });
      try {
        await provider.generateResponse('Hello', dummyContext);
        fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).not.toContain('test-gemini');
        expect(err.message).toContain('[REDACTED_KEY]');
      }
    });
  });

  describe('OpenRouterProvider', () => {
    const provider = new OpenRouterProvider();

    it('handles successful generation', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"type":"final","response":"success"}' } }]
        })
      });

      const res = await provider.generateResponse('Hello', dummyContext);
      expect(res.response).toBe('success');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Authorization': 'Bearer test-openrouter' })
        })
      );
    });
  });

  describe('GroqProvider', () => {
    const provider = new GroqProvider();

    it('handles successful generation', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"type":"final","response":"success"}' } }]
        })
      });

      const res = await provider.generateResponse('Hello', dummyContext);
      expect(res.response).toBe('success');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Authorization': 'Bearer test-groq' })
        })
      );
    });
  });
});
