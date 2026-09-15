import { OpenRouterProvider } from '../lib/ai/providers/openrouter';
import { AI_CONFIG } from '../lib/ai/config';
import fs from 'fs';

async function run() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  const orKey = env.split('\n').find(l => l.startsWith('OPENROUTER_API_KEY='))?.split('=')[1]?.trim();
  AI_CONFIG.openrouter.apiKey = orKey || '';
  const provider = new OpenRouterProvider();
  provider.capabilities.toolCalling = true;

  try {
    const response = await provider.generateResponse('What should I work on today?', {
      userId: 'test',
      memories: [],
      recentTasks: [],
      observations: [],
      workingContext: [],
      systemPrompt: 'You have access to tools. Reply with a tool call to delegate_to_agent.'
    });

    console.log("RESPONSE:", response);
  } catch (e: any) {
    console.error("ERROR:", e.message);
  }
}

run();
