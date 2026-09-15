"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalAgentClient = exports.startAgent = void 0;
// local-agent/src/index.ts
const server_1 = require("./server");
Object.defineProperty(exports, "startAgent", { enumerable: true, get: function () { return server_1.startAgent; } });
const client_1 = require("./client");
Object.defineProperty(exports, "LocalAgentClient", { enumerable: true, get: function () { return client_1.LocalAgentClient; } });
// Startup hook
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args[0] === 'pair' && args[1]) {
        const code = args[1];
        Promise.resolve().then(() => __importStar(require('./authentication'))).then(({ pairWithCode }) => {
            pairWithCode(code).catch((err) => {
                console.error('[LocalAgent] Pairing failed:', err.message);
                process.exit(1);
            });
        });
    }
    else {
        const cloudUrl = process.env.ORBIT_CLOUD_WS_URL;
        if (cloudUrl) {
            console.log(`[LocalAgent] Connecting client to ${cloudUrl}`);
            const client = new client_1.LocalAgentClient(cloudUrl);
            client.start();
        }
        else {
            (0, server_1.startAgent)();
        }
    }
}
