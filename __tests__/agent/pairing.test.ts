import { POST as pairInit } from '@/app/api/agent/devices/pair/init/route';
import { POST as pairPoll } from '@/app/api/agent/devices/pair/poll/route';
import { POST as pairComplete } from '@/app/api/agent/devices/pair/complete/route';
import { POST as revoke } from '@/app/api/agent/devices/[id]/revoke/route';

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null })
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'test-session', code: '123456', expires_at: new Date(Date.now() + 50000).toISOString() }, error: null })
  }))
}));

describe('Local Agent Pairing', () => {
  it('initializes pairing session successfully', async () => {
    const req = new Request('http://localhost:3000/api/agent/devices/pair/init', { method: 'POST' });
    const res = await pairInit(req);
    const json = await res.json();
    
    expect(res.status).toBe(200);
    expect(json).toHaveProperty('sessionId');
    expect(json).toHaveProperty('code');
    expect(json).toHaveProperty('expiresAt');
  });

  it('polls pairing session successfully', async () => {
    const req = new Request('http://localhost:3000/api/agent/devices/pair/poll', { 
      method: 'POST',
      body: JSON.stringify({ sessionId: 'test-session' })
    });
    const res = await pairPoll(req);
    const json = await res.json();
    
    expect(res.status).toBe(200);
  });
});
