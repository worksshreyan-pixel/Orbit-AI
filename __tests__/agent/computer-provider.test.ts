import { getLocalAgentConnection } from '../../lib/agent/providers/local-agent-connection';
import { LocalAgentComputerProvider } from '../../lib/agent/providers/local-agent-provider';

// Mock ws
jest.mock('ws');
import WebSocket from 'ws';
import { EventEmitter } from 'events';

describe('Local Agent Computer Provider Integration', () => {
  let provider: LocalAgentComputerProvider;
  let mockWs: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock WebSocket
    mockWs = new EventEmitter();
    mockWs.send = jest.fn();
    mockWs.close = jest.fn();
    mockWs.readyState = WebSocket.OPEN;
    
    (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

    // Reset global cache
    const globalForConnection = global as any;
    globalForConnection.localAgentManager = undefined;

    provider = new LocalAgentComputerProvider('ws://localhost:3001/ws', 'test-credential');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('maps getSystemInfo capability correctly', async () => {
    const manager = getLocalAgentConnection({ wsUrl: 'ws://localhost:3001/ws', credential: 'test-credential' });
    
    // Start connection
    const connectPromise = manager.connect();
    mockWs.emit('open');
    mockWs.emit('message', Buffer.from(JSON.stringify({ type: 'auth_result', success: true })));
    await connectPromise;
    
    // Now call getSystemInfo
    const sysPromise = provider.getSystemInfo();
    
    // Give event loop a tick to process sendRequest
    await new Promise(r => setImmediate(r));
    
    // Verify capability sent
    expect(mockWs.send).toHaveBeenCalledTimes(2); // 1 for auth, 1 for get_system_info
    const sentArgs = JSON.parse(mockWs.send.mock.calls[1][0]);
    expect(sentArgs.capability).toBe('get_system_info');
    
    // Simulate response
    mockWs.emit('message', Buffer.from(JSON.stringify({
      type: 'response',
      requestId: sentArgs.requestId,
      success: true,
      data: { platform: 'win32' }
    })));
    
    const result = await sysPromise;
    expect(result.platform).toBe('win32');
  });

  it('maps takeScreenshot capability correctly', async () => {
    const manager = getLocalAgentConnection({ wsUrl: 'ws://localhost:3001/ws', credential: 'test-credential' });
    
    const connectPromise = manager.connect();
    mockWs.emit('open');
    mockWs.emit('message', Buffer.from(JSON.stringify({ type: 'auth_result', success: true })));
    await connectPromise;
    
    const promise = provider.takeScreenshot();
    
    await new Promise(r => setImmediate(r));
    
    const sentArgs = JSON.parse(mockWs.send.mock.calls[1][0]);
    expect(sentArgs.capability).toBe('take_screenshot');
    
    mockWs.emit('message', Buffer.from(JSON.stringify({
      type: 'response',
      requestId: sentArgs.requestId,
      success: true,
      data: { data: 'base64', mimeType: 'image/png' }
    })));
    
    const result = await promise;
    expect(result.data).toBe('base64');
    expect(result.mimeType).toBe('image/png');
  });
});
