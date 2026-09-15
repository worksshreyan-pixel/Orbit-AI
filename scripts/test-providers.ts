import './env';

import { GeminiProvider } from '../lib/ai/providers/gemini';
import { OpenRouterProvider } from '../lib/ai/providers/openrouter';
import { GroqProvider } from '../lib/ai/providers/groq';

console.log('--- Environment Verification ---');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'configured' : 'not configured');
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'configured' : 'not configured');
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'configured' : 'not configured');
console.log('--------------------------------\n');

async function testProvider(name: string, ProviderClass: any) {
  console.log(`Testing provider: ${name}`);
  const provider = new ProviderClass();
  const start = Date.now();
  
  try {
    const response = await provider.generateResponse('Reply with exactly: ORBIT_OK', {
      userId: 'test',
      memories: [],
      recentTasks: [],
      observations: [],
      workingContext: [],
      systemPrompt: 'You are a testing agent.'
    });
    
    console.log(`[SUCCESS] ${name}`);
    console.log(JSON.stringify({
      success: true,
      provider: name,
      model: provider.capabilities ? 'capabilities-configured' : 'unknown',
      latencyMs: Date.now() - start,
      httpStatus: 200,
      category: 'NONE',
      message: response.response
    }, null, 2));
    
  } catch (error: any) {
    console.log(`[FAILED] ${name}`);
    console.log(JSON.stringify({
      success: false,
      provider: name,
      model: provider.capabilities ? 'capabilities-configured' : 'unknown',
      latencyMs: Date.now() - start,
      httpStatus: error.httpStatus || 'unknown',
      category: error.category || 'UNKNOWN',
      message: error.message
    }, null, 2));
  }
  console.log('\n');
}

async function testToolCalling(name: string, ProviderClass: any) {
  console.log(`\nTesting tool calling: ${name}`);
  const provider = new ProviderClass();
  
  // Temporarily override capabilities to force tool calling test
  if (provider.capabilities) {
    provider.capabilities.toolCalling = true;
  }

  // We have to modify the provider to pass tools for the test, but since we are just diagnosing, 
  // let's pass context.tools. However, the OpenRouter provider doesn't currently read context.tools!
  // I need to modify OpenRouterProvider first. Let's just log this for now.
}

async function runAll() {
  await testProvider('gemini', GeminiProvider);
  await testProvider('openrouter', OpenRouterProvider);
  await testProvider('groq', GroqProvider);
}

runAll().catch(console.error);
