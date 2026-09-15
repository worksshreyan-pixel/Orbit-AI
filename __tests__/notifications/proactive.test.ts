import { notifyUser } from '../../lib/notifications/proactive';
import { createServerClient } from '../../lib/supabase/server';
import { getLocalAgentConnection } from '../../lib/agent/providers/local-agent-connection';

jest.mock('../../lib/supabase/server', () => ({
  createServerClient: jest.fn()
}));

jest.mock('../../lib/agent/providers/local-agent-connection', () => ({
  getLocalAgentConnection: jest.fn()
}));

describe('notifyUser', () => {
  const mockInsert = jest.fn();
  const mockSendEvent = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();

    (createServerClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: mockInsert
          })
        })
      })
    });

    (getLocalAgentConnection as jest.Mock).mockReturnValue({
      sendEvent: mockSendEvent
    });
  });

  it('inserts into notifications and sends to local agent', async () => {
    mockInsert.mockResolvedValue({ data: { id: '1' }, error: null });
    
    const result = await notifyUser({
      userId: 'user1',
      type: 'info',
      title: 'Test Notification',
      message: 'Test message',
      priority: 'high',
      speak: true
    });

    expect(result).toEqual({ id: '1' });
    
    // Check Supabase insert
    const supabase = createServerClient();
    expect(supabase.from).toHaveBeenCalledWith('notifications');
    
    // Check local agent event
    expect(getLocalAgentConnection).toHaveBeenCalled();
    expect(mockSendEvent).toHaveBeenCalledWith('notification', {
      type: 'info',
      title: 'Test Notification',
      message: 'Test message',
      priority: 'high',
      speak: true,
      metadata: {}
    });
  });
});
