import type { AIProvider, AIContext, AIResponse } from '@/lib/types/agent';
import { ProviderErrorCategory, ProviderCapabilities, normalizeAIError } from '../types';
import { AI_CONFIG } from '../config';
import { buildSystemPrompt, convertToJSONSchema } from '../utils';

export class OpenRouterProvider implements AIProvider {
  name = 'openrouter';
  capabilities: ProviderCapabilities = {
    textGeneration: true,
    toolCalling: false, // Baseline for now
    structuredOutput: false, // Baseline for now
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
    const { apiKey, defaultModel } = AI_CONFIG.openrouter;
    if (!apiKey) {
      throw normalizeAIError(401, 'API key missing');
    }

    const systemPrompt = context.systemPrompt || buildSystemPrompt(context);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const payload: any = {
        model: defaultModel,
        messages: context.messages || [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 1024,
      };

      if (context.availableTools && context.availableTools.length > 0) {
        payload.tools = context.availableTools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: convertToJSONSchema(t.parameters)
          }
        }));
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://orbit.example.com',
          'X-Title': 'ORBIT Agent',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `OpenRouter API error: ${response.status}`;
        let providerErrorCode = undefined;
        let providerErrorType = undefined;
        
        try {
          const parsedError = JSON.parse(errorText);
          if (parsedError.error) {
            errorMessage = parsedError.error.message || errorMessage;
            providerErrorCode = parsedError.error.code?.toString();
            providerErrorType = parsedError.error.type;
          }
        } catch (e) {
          errorMessage += ` - ${errorText}`;
        }
        
        throw normalizeAIError(response.status, errorMessage, null, providerErrorCode, providerErrorType);
      }

      const data = await response.json();
      console.log('--- OPENROUTER RAW RESPONSE ---');
      console.log(JSON.stringify(data.choices?.[0]?.message, null, 2));
      console.log('-------------------------------');
      
      const message = data?.choices?.[0]?.message;
      if (message?.tool_calls && message.tool_calls.length > 0) {
        return {
          type: 'tool_call',
          toolCalls: message.tool_calls.map((tc: any) => {
            let normalizedName = tc.function.name || '';
            // Strip OpenRouter/Harmony channel protocol contamination
            if (normalizedName.includes('<|channel|>commentary')) {
              normalizedName = normalizedName.replace('<|channel|>commentary', '').trim();
            }
            return {
              id: tc.id,
              toolName: normalizedName,
              parameters: JSON.parse(tc.function.arguments || '{}')
            };
          })
        };
      }
      
      const text = message?.content || '{}';
      
      try {
        const parsed = JSON.parse(text);
        if (parsed.type === 'tool_call' && parsed.tool && !parsed.toolCalls) {
          parsed.toolCalls = [{ toolName: parsed.tool, parameters: parsed.arguments || {} }];
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
