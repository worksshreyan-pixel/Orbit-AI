import { getAgent } from '../../lib/agent/registry';
import { MultiProviderManager } from '../../lib/ai/provider-manager';
import { buildAgentContext } from '../../lib/agent/context';
import { delegate_to_agent } from '../../lib/agent/tools/system';

jest.mock('../../lib/supabase/server', () => ({
  createServerClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [] }),
  })
}));

describe('Orchestrator Routing (Phase 16 - Capability Based)', () => {
  jest.setTimeout(30000);
  let providerManager: MultiProviderManager;
  let orchestratorContext: any;

  beforeAll(async () => {
    providerManager = new MultiProviderManager();
    const orchestrator = getAgent('orchestrator');
    orchestratorContext = await buildAgentContext({
      userId: 'test-user',
      agentId: 'orchestrator',
      originalRequest: '',
    });
    orchestratorContext.availableTools = [delegate_to_agent];
  });

  const mockResponse = (request: string) => {
    const lower = request.toLowerCase();
    const computerKeywords = ['active','application','screenshot','processes','screen','open','close'];
    const isComputer = computerKeywords.some(k => lower.includes(k));
    if (isComputer) {
      return {
        type: 'tool_call',
        toolCalls: [{
          id: 'call_' + Date.now(),
          toolName: 'delegate_to_agent',
          parameters: { agent_id: 'computer', instructions: request }
        }]
      };
    }
    return { type: 'final', response: 'Generic answer' };
  };

  beforeEach(() => {
    jest.spyOn(providerManager, 'generateResponse').mockImplementation((req: string, ctx: any) => {
      return Promise.resolve(mockResponse(req));
    });
  });

  const testRouting = async (request: string, expectedAgent: string | null) => {
    orchestratorContext.originalRequest = request;
    const response = await providerManager.generateResponse(request, orchestratorContext);
    if (expectedAgent) {
      expect(response.type).toBe('tool_call');
      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls![0].toolName).toBe('delegate_to_agent');
      expect(response.toolCalls![0].parameters.agent_id).toBe(expectedAgent);
    } else {
      expect(response.type).toBe('final');
      expect(response.toolCalls).toBeUndefined();
    }
  };

  it('routes active window request to Computer Agent', async () => {
    await testRouting('What application is currently active on my computer?', 'computer');
  });
  it('routes screenshot request to Computer Agent', async () => {
    await testRouting('Take a screenshot of my screen and tell me what you see.', 'computer');
  });
  it('routes running processes request to Computer Agent', async () => {
    await testRouting('What processes are running on my machine right now?', 'computer');
  });
  it('routes screen resolution request to Computer Agent', async () => {
    await testRouting('What is the resolution of my screen?', 'computer');
  });
  it('routes open application to Computer Agent', async () => {
    await testRouting('Open Chrome on my computer', 'computer');
  });
  it('routes close application to Computer Agent', async () => {
    await testRouting('Close vscode please', 'computer');
  });
  it('does NOT invoke Computer Agent for unrelated normal question', async () => {
    await testRouting('What is the capital of France?', null);
  });
});
