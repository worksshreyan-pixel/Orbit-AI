import type { AIProvider, AIContext, AIResponse } from '@/lib/types/agent';
import { ProviderErrorCategory, ProviderCapabilities, normalizeAIError } from '../types';
import { AI_CONFIG } from '../config';
import { buildSystemPrompt } from '../utils';

export class GeminiProvider implements AIProvider {
  name = 'gemini';
  capabilities: ProviderCapabilities = {
    textGeneration: true,
    toolCalling: true,
    structuredOutput: true,
    streaming: false,
    vision: false
  };

  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.generateResponse('Reply with exactly: ORBIT_OK', {
        userId: 'system-health',
        memories: [],
        recentTasks: [],
        observations: [],
        workingContext: [],
      });
      return response.response === 'ORBIT_OK' || response.response?.includes('ORBIT_OK') || false;
    } catch {
      return false;
    }
  }

  async generateResponse(prompt: string, context: AIContext): Promise<AIResponse> {
    const { apiKey, defaultModel } = AI_CONFIG.gemini;
    if (!apiKey) {
      throw normalizeAIError(401, 'API key missing');
    }

    const systemPrompt = context.systemPrompt || buildSystemPrompt(context);

    const geminiPrompt = context.messages 
      ? context.messages.map(m => {
          if (m.role === 'tool') {
            return `Tool Result (${m.tool_call_id}): ${m.content}`;
          } else if (m.role === 'assistant' && m.tool_calls) {
            return `Assistant Call: ${JSON.stringify(m.tool_calls)}`;
          }
          return `${m.role.toUpperCase()}: ${m.content || ''}`;
        }).join('\n\n')
      : `SYSTEM: ${systemPrompt}\n\nUSER: ${prompt}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${defaultModel}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: geminiPrompt }] }],
            generationConfig: { 
              temperature: 0.2, 
              maxOutputTokens: 1024,
              responseMimeType: 'application/json'
            },
          }),
          signal: controller.signal
        }
      );
      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Gemini API error: ${response.status}`;
        let providerErrorCode = undefined;
        let providerErrorType = undefined;
        
        try {
          const parsedError = JSON.parse(errorText);
          if (parsedError.error) {
            errorMessage = parsedError.error.message || errorMessage;
            providerErrorCode = parsedError.error.code?.toString();
            providerErrorType = parsedError.error.status;
          }
        } catch (e) {
          errorMessage += ` - ${errorText}`;
        }
        
        throw normalizeAIError(response.status, errorMessage, null, providerErrorCode, providerErrorType);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      try {
        const parsed = JSON.parse(text);
        if (parsed.type === 'tool_call' && parsed.tool && !parsed.toolCalls) {
          parsed.toolCalls = [{ id: 'gemini-' + Date.now(), toolName: parsed.tool, parameters: parsed.arguments || {} }];
        }
        return { ...parsed, confidence: 0.8 };
      } catch (e) {
        // Fallback: if the model returned plain text instead of JSON, wrap it gracefully.
        return { type: 'final', response: text, confidence: 0.5 };
      }
    } catch (err: any) {
      clearTimeout(timeout);
      if (err && err.name === 'ProviderError') throw err;
      throw normalizeAIError(undefined, err instanceof Error ? err.message : String(err), err);
    }
  }
}
