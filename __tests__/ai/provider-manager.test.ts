import { MultiProviderManager } from '../../lib/ai/provider-manager';
import { GeminiProvider } from '../../lib/ai/providers/gemini';
import { OpenRouterProvider } from '../../lib/ai/providers/openrouter';
import { GroqProvider } from '../../lib/ai/providers/groq';
import { AI_CONFIG } from '../../lib/ai/config';
import { ProviderErrorCategory, ProviderError } from '../../lib/ai/types';

// Mock dependencies
jest.mock('../../lib/ai/providers/gemini', () => {
  const original = jest.requireActual('../../lib/ai/providers/gemini');
  return {
    ...original,
    GeminiProvider: jest.fn()
  };
});
jest.mock('../../lib/ai/providers/openrouter');
jest.mock('../../lib/ai/providers/groq');
jest.mock('../../lib/ai/config', () => ({
  AI_CONFIG: {
    primaryProvider: 'gemini',
    gemini: { apiKey: 'test-gemini-key', defaultModel: 'gemini-3.7-flash' },
    openrouter: { apiKey: 'test-openrouter-key', defaultModel: 'llama-3' },
    groq: { apiKey: 'test-groq-key', defaultModel: 'llama3-8b-8192' },
  }
}));

describe('MultiProviderManager', () => {
  let manager: MultiProviderManager;
  let mockGemini: jest.Mocked<GeminiProvider>;
  let mockOpenRouter: jest.Mocked<OpenRouterProvider>;
  let mockGroq: jest.Mocked<GroqProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock instances
    mockGemini = { name: 'gemini', generateResponse: jest.fn(), checkHealth: jest.fn() } as unknown as jest.Mocked<GeminiProvider>;
    mockOpenRouter = { name: 'openrouter', generateResponse: jest.fn(), checkHealth: jest.fn() } as unknown as jest.Mocked<OpenRouterProvider>;
    mockGroq = { name: 'groq', generateResponse: jest.fn(), checkHealth: jest.fn() } as unknown as jest.Mocked<GroqProvider>;

    (GeminiProvider as jest.Mock).mockImplementation(() => mockGemini);
    (OpenRouterProvider as jest.Mock).mockImplementation(() => mockOpenRouter);
    (GroqProvider as jest.Mock).mockImplementation(() => mockGroq);

    manager = new MultiProviderManager();
    // Suppress console.log for clean test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  const dummyContext = { memories: [], recentTasks: [], observations: [], workingContext: [], userId: 'user-1' };

  it('selects and successfully uses primary provider', async () => {
    mockGemini.generateResponse.mockResolvedValue({ type: 'final', response: 'Success from Gemini', confidence: 0.9 });
    
    const result = await manager.generateResponse('Hello', dummyContext);
    
    expect(mockGemini.generateResponse).toHaveBeenCalled();
    expect(mockOpenRouter.generateResponse).not.toHaveBeenCalled();
    expect(result.response).toBe('Success from Gemini');
  });

  it('falls back to secondary provider on QUOTA error', async () => {
    mockGemini.generateResponse.mockRejectedValue(new ProviderError(ProviderErrorCategory.QUOTA, 'Rate limit exceeded'));
    mockOpenRouter.generateResponse.mockResolvedValue({ type: 'final', response: 'Success from OpenRouter', confidence: 0.9 });

    const result = await manager.generateResponse('Hello', dummyContext);
    
    expect(mockGemini.generateResponse).toHaveBeenCalled();
    expect(mockOpenRouter.generateResponse).toHaveBeenCalled();
    expect(mockGroq.generateResponse).not.toHaveBeenCalled();
    expect(result.response).toBe('Success from OpenRouter');
  });

  it('fast-fails and does not fallback on INVALID_REQUEST', async () => {
    mockGemini.generateResponse.mockRejectedValue(new ProviderError(ProviderErrorCategory.INVALID_REQUEST, 'Bad request'));

    await expect(manager.generateResponse('Hello', dummyContext)).rejects.toThrow('Bad request');
    
    expect(mockGemini.generateResponse).toHaveBeenCalled();
    expect(mockOpenRouter.generateResponse).not.toHaveBeenCalled();
  });

  it('cascades through all providers and returns graceful error if all fail', async () => {
    mockGemini.generateResponse.mockRejectedValue(new ProviderError(ProviderErrorCategory.NETWORK, 'Fail 1'));
    mockOpenRouter.generateResponse.mockRejectedValue(new ProviderError(ProviderErrorCategory.NETWORK, 'Fail 2'));
    mockGroq.generateResponse.mockRejectedValue(new ProviderError(ProviderErrorCategory.NETWORK, 'Fail 3'));

    await expect(manager.generateResponse('Hello', dummyContext)).rejects.toThrow('All configured AI providers are unavailable. Check your provider configuration or try again later.');
    
    expect(mockGemini.generateResponse).toHaveBeenCalled();
    expect(mockOpenRouter.generateResponse).toHaveBeenCalled();
    expect(mockGroq.generateResponse).toHaveBeenCalled();
  });
});
