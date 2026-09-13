import type { AIProvider, AIContext, AIResponse } from '@/lib/types/agent';

export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || 'gemini';
  const apiKey = process.env.AI_API_KEY;

  return {
    name: provider,
    generateResponse: async (prompt: string, context: AIContext): Promise<AIResponse> => {
      if (!apiKey) {
        return {
          text: 'AI provider is not configured. Set the AI_API_KEY environment variable to enable AI responses. The agent architecture is in place — once a provider key is added, this will route through the configured AI service.',
          confidence: 0,
        };
      }

      try {
        if (provider === 'gemini') {
          return await callGemini(prompt, context, apiKey);
        }
        return {
          text: `Provider "${provider}" is not yet implemented. The architecture supports adding new providers — implement the handler in lib/agent/ai-provider.ts.`,
          confidence: 0,
        };
      } catch (err) {
        return {
          text: 'The AI provider encountered an error. Please check the API key and try again.',
          confidence: 0,
          ...(err instanceof Error ? { error: err.message } : {}),
        } as AIResponse;
      }
    },
  };
}

async function callGemini(prompt: string, context: AIContext, apiKey: string): Promise<AIResponse> {
  const systemPrompt = context.systemPrompt || buildSystemPrompt(context);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nUser request: ${prompt}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

  return { text, confidence: 0.8 };
}

function buildSystemPrompt(context: AIContext): string {
  const memoryStr = context.memories.length > 0
    ? `\nKnown context:\n${context.memories.map((m) => `- ${m}`).join('\n')}`
    : '';
  const taskStr = context.recentTasks.length > 0
    ? `\nRecent tasks:\n${context.recentTasks.map((t) => `- ${t}`).join('\n')}`
    : '';

  return `You are ORBIT, a private personal AI operating system for a single user. You help manage projects, tasks, ideas, research, and personal productivity. Be concise, intelligent, and actionable.${memoryStr}${taskStr}`;
}
