import type { AIProvider, AIContext, AIResponse } from '@/lib/types/agent';
import { ProviderErrorCategory, ProviderDiagnostic, ProviderCapabilities, ProviderError } from './types';
import { GeminiProvider } from './providers/gemini';
import { OpenRouterProvider } from './providers/openrouter';
import { GroqProvider } from './providers/groq';
import { AI_CONFIG } from './config';

export class MultiProviderManager implements AIProvider {
  name = 'MultiProviderManager';
  capabilities: ProviderCapabilities = {
    textGeneration: true,
    toolCalling: true,
    structuredOutput: true,
    streaming: false,
    vision: false
  };

  private providers: Map<string, AIProvider> = new Map();
  private fallbackOrder: string[] = ['gemini', 'openrouter', 'groq'];
  private cooldowns: Map<string, number> = new Map();

  constructor() {
    this.providers.set('gemini', new GeminiProvider());
    this.providers.set('openrouter', new OpenRouterProvider());
    this.providers.set('groq', new GroqProvider());

    const primary = AI_CONFIG.primaryProvider.toLowerCase();
    if (this.fallbackOrder.includes(primary)) {
      this.fallbackOrder = [
        primary,
        ...this.fallbackOrder.filter((p) => p !== primary)
      ];
    }
  }

  async checkHealth(): Promise<boolean> {
    for (const providerName of this.fallbackOrder) {
      const provider = this.providers.get(providerName);
      if (provider && await provider.checkHealth()) {
        return true;
      }
    }
    return false;
  }

  private logDiagnostic(diagnostic: ProviderDiagnostic) {
    const lines = [
      `[AI Diagnostic]`,
      `Provider: ${diagnostic.provider}`,
      `Model: ${diagnostic.model}`,
      `Status: ${diagnostic.httpStatus || 'ERROR'}`,
      diagnostic.errorCategory ? `Category: ${diagnostic.errorCategory}` : '',
      `Latency: ${diagnostic.latencyMs}ms`,
      diagnostic.providerErrorType ? `ProviderType: ${diagnostic.providerErrorType}` : '',
      diagnostic.providerErrorCode ? `ProviderCode: ${diagnostic.providerErrorCode}` : '',
      diagnostic.errorMessage ? `Message: ${diagnostic.errorMessage}` : ''
    ].filter(Boolean);
    console.log(lines.join('\n'));

    // Manual test trace logging
    console.log('[ORBIT PROVIDER TRACE]');
    console.log(`provider: ${diagnostic.provider}`);
    console.log(`status: ${diagnostic.httpStatus || 'ERROR'}`);
    console.log(`latency: ${diagnostic.latencyMs}`);
    console.log(`cooldownUntil: ${diagnostic.cooldownUntil || ''}`);
    console.log(`fallbackUsed: ${diagnostic.fallbackUsed || false}`);
  }

  async generateResponse(prompt: string, context: AIContext): Promise<AIResponse> {
    const attemptedProviders: string[] = [];
    let currentFallbackOrder = this.fallbackOrder;

    if (context.modelProfile) {
      const { primary, fallback } = context.modelProfile;
      const order = [];
      if (primary && this.providers.has(primary)) order.push(primary);
      if (fallback && this.providers.has(fallback) && fallback !== primary) order.push(fallback);
      
      // Append any remaining providers from the global fallback just in case
      for (const p of this.fallbackOrder) {
        if (!order.includes(p)) order.push(p);
      }
      currentFallbackOrder = order;
    }

    for (const providerName of currentFallbackOrder) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      const cooldownUntil = this.cooldowns.get(providerName) || 0;
      if (Date.now() < cooldownUntil) {
        continue; // Skip this provider due to cooldown
      }

      const start = Date.now();
      try {
        const response = await provider.generateResponse(prompt, context);
        
        this.logDiagnostic({
          provider: providerName,
          model: (AI_CONFIG as any)[providerName]?.defaultModel || 'unknown',
          latencyMs: Date.now() - start,
          httpStatus: 200,
          fallbackUsed: attemptedProviders.length > 0,
        });

        return response;
      } catch (err: any) {
        attemptedProviders.push(providerName);
        let category = ProviderErrorCategory.UNKNOWN;
        let httpStatus = undefined;
        let providerErrorType = undefined;
        let providerErrorCode = undefined;
        let errorMessage = String(err);
        
        if (err && err.name === 'ProviderError') {
          category = err.category;
          httpStatus = err.httpStatus;
          providerErrorType = err.providerErrorType;
          providerErrorCode = err.providerErrorCode;
          errorMessage = err.message;
        }

        if ([503, 429].includes(httpStatus as number) || category === ProviderErrorCategory.NETWORK) {
          this.cooldowns.set(providerName, Date.now() + 120_000); // 120 seconds cooldown
        }

        this.logDiagnostic({
          provider: providerName,
          model: (AI_CONFIG as any)[providerName]?.defaultModel || 'unknown',
          latencyMs: Date.now() - start,
          httpStatus,
          errorCategory: category,
          providerErrorCode,
          providerErrorType,
          errorMessage,
          cooldownUntil: this.cooldowns.get(providerName),
          fallbackUsed: attemptedProviders.length > 1, // At this point, the current one is in attemptedProviders, so length > 1 means it fell back
        });

        if (category === ProviderErrorCategory.INVALID_REQUEST) {
          throw err;
        }
      }
    }

    throw new Error('All configured AI providers are unavailable. Check your provider configuration or try again later.');
  }
}

let instance: MultiProviderManager | null = null;
export function getAIProvider(): AIProvider {
  if (!instance) {
    instance = new MultiProviderManager();
  }
  return instance;
}
