import { getLocalAgentConnection } from '../../lib/agent/providers/local-agent-connection';
import { LocalAgentWorkspaceProvider } from '../../lib/agent/providers/local-agent-provider';

// Mock ws
jest.mock('ws');
import WebSocket from 'ws';
import { EventEmitter } from 'events';

describe('Local Agent Provider Integration', () => {
  let provider: LocalAgentWorkspaceProvider;
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

    provider = new LocalAgentWorkspaceProvider('ws://localhost:3001/ws', 'test-credential');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('connects and authenticates before sending requests', async () => {
    // We mock the connect process by emitting open and simulating auth_result
    const connectPromise = getLocalAgentConnection({ wsUrl: 'ws://localhost:3001/ws', credential: 'test-credential' }).connect();
    
    mockWs.emit('open');
    
    // Should have sent auth
    expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('"event":"authenticate"'));
    
    // Simulate auth success
    mockWs.emit('message', Buffer.from(JSON.stringify({ type: 'auth_result', success: true })));
    
    await connectPromise;
  });

  it('rejects connection if auth fails', async () => {
    const connectPromise = getLocalAgentConnection({ wsUrl: 'ws://localhost:3001/ws', credential: 'test-credential' }).connect();
    
    mockWs.emit('open');
    mockWs.emit('message', Buffer.from(JSON.stringify({ type: 'auth_result', success: false })));
    
    await expect(connectPromise).rejects.toThrow('LOCAL_AGENT_AUTH_FAILED');
  });

  it('maps readFile capability correctly', async () => {
    const manager = getLocalAgentConnection({ wsUrl: 'ws://localhost:3001/ws', credential: 'test-credential' });
    
    // Start connection
    const connectPromise = manager.connect();
    mockWs.emit('open');
    mockWs.emit('message', Buffer.from(JSON.stringify({ type: 'auth_result', success: true })));
    await connectPromise;
    
    // Now call readFile
    const readPromise = provider.readFile('/project', 'file.txt');
    
    // Give event loop a tick to process sendRequest
    await new Promise(r => setImmediate(r));
    
    // Verify capability sent
    expect(mockWs.send).toHaveBeenCalledTimes(2); // 1 for auth, 1 for read_file
    const sentArgs = JSON.parse(mockWs.send.mock.calls[1][0]);
    expect(sentArgs.capability).toBe('read_file');
    expect(sentArgs.args.path).toBe('/project/file.txt');
    
    // Simulate response
    mockWs.emit('message', Buffer.from(JSON.stringify({
      type: 'response',
      requestId: sentArgs.requestId,
      success: true,
      data: 'file content'
    })));
    
    const result = await readPromise;
    expect(result).toBe('file content');
  });

  it('maps writeFile capability correctly', async () => {
    const manager = getLocalAgentConnection({ wsUrl: 'ws://localhost:3001/ws', credential: 'test-credential' });
    
    const connectPromise = manager.connect();
    mockWs.emit('open');
    mockWs.emit('message', Buffer.from(JSON.stringify({ type: 'auth_result', success: true })));
    await connectPromise;
    
    const writePromise = provider.writeFile('/project', 'file.txt', 'data');
    
    await new Promise(r => setImmediate(r));
    
    const sentArgs = JSON.parse(mockWs.send.mock.calls[1][0]);
    expect(sentArgs.capability).toBe('write_file');
    expect(sentArgs.args.path).toBe('/project/file.txt');
    expect(sentArgs.args.content).toBe('data');
    
    mockWs.emit('message', Buffer.from(JSON.stringify({
      type: 'response',
      requestId: sentArgs.requestId,
      success: true,
      data: null
    })));
    
    await expect(writePromise).resolves.toBeUndefined();
  });
});
