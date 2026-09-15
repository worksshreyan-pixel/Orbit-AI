import { getAgent, agentRegistry } from '../../lib/agent/registry';
import { buildAgentContext } from '../../lib/agent/context';
import { createServerClient } from '../../lib/supabase/server';

jest.mock('../../lib/supabase/server', () => {
  const mSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [] }),
  };
  return {
    createServerClient: jest.fn(() => mSupabase),
  };
});

describe('Phase 12: Agent Architecture Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Agent Registry & Models', () => {
    it('returns explicitly registered specialist agents', () => {
      const planner = getAgent('planner');
      expect(planner).toBeDefined();
      expect(planner?.id).toBe('planner');
      expect(planner?.modelProfile?.primary).toBe('groq');

      const researcher = getAgent('researcher');
      expect(researcher).toBeDefined();
      expect(researcher?.id).toBe('researcher');
      expect(researcher?.modelProfile?.primary).toBe('gemini');

      const developer = getAgent('developer');
      expect(developer).toBeDefined();
      expect(developer?.id).toBe('developer');
      expect(developer?.modelProfile?.primary).toBe('openrouter');
    });

    it('removes textual identity prompts from agent definitions', () => {
      const dev = getAgent('developer');
      expect(dev?.systemPrompt).not.toMatch(/You are the ORBIT Developer Agent/i);
    });

    it('has no duplicate agent IDs', () => {
      const keys = Object.keys(agentRegistry);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });
  });

  describe('Context Builder Isolation', () => {
    it('builds context strictly based on agent context requirements', async () => {
      // Developer requires 'projects', 'research' but NOT 'memories' or 'tasks'
      const context = await buildAgentContext({ userId: 'test-user', agentId: 'developer', originalRequest: 'Fix the bug' });
      
      const supabaseClient = createServerClient();
      expect(supabaseClient.from).toHaveBeenCalledWith('projects');
      expect(supabaseClient.from).toHaveBeenCalledWith('research');
      
      // Should NOT have been called for memories and tasks
      expect(supabaseClient.from).not.toHaveBeenCalledWith('memories');
      expect(supabaseClient.from).not.toHaveBeenCalledWith('tasks');

      // Check context structure
      expect(context.modelProfile?.primary).toBe('openrouter');
      expect(context.originalRequest).toBe('Fix the bug');
    });

    it('preserves original request throughout context creation', async () => {
      const ctx = await buildAgentContext({ userId: 'u1', agentId: 'planner', originalRequest: 'What should I do today?' });
      expect(ctx.originalRequest).toBe('What should I do today?');
    });
  });
});
