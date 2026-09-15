// local-agent/src/index.ts
import { startAgent } from "./server";
import { LocalAgentClient } from "./client";

export { startAgent, LocalAgentClient };

// Startup hook
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === 'pair' && args[1]) {
    const code = args[1];
    import('./authentication').then(({ pairWithCode }) => {
      pairWithCode(code).catch((err) => {
        console.error('[LocalAgent] Pairing failed:', err.message);
        process.exit(1);
      });
    });
  } else {
    const cloudUrl = process.env.ORBIT_CLOUD_WS_URL;
    if (cloudUrl) {
      console.log(`[LocalAgent] Connecting client to ${cloudUrl}`);
      const client = new LocalAgentClient(cloudUrl);
      client.start();
    } else {
      startAgent();
    }
  }
}
