export const AI_CONFIG = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '',
    defaultModel: 'gemini-3.7-flash', // We found 3.7-flash is stable and working
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    defaultModel: 'openai/gpt-oss-20b',
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    defaultModel: 'openai/gpt-oss-20b',
  },
  primaryProvider: process.env.PRIMARY_AI_PROVIDER || 'gemini',
};
