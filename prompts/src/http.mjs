import {createMcpExpressApp} from '@modelcontextprotocol/sdk/server/express.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {createPromptServer} from './server.mjs';
// Loopback only. A hosted deployment must terminate TLS, validate its public
// Host/Origin and enforce ingress limits before forwarding to this process.
export function createHttpApp(client) {
  const app = createMcpExpressApp({host:'127.0.0.1'});
  app.use((req,res,next) => {
    if (req.headers.origin) {
      try {
        const origin = new URL(req.headers.origin);
        if (!['http:','https:'].includes(origin.protocol) || !['127.0.0.1','localhost','[::1]'].includes(origin.hostname) || origin.host !== req.headers.host) return res.status(403).end();
      } catch { return res.status(403).end(); }
    }
    res.setHeader('Cache-Control','no-store'); next();
  });
  app.post('/mcp',async (req,res) => {
    const server = createPromptServer(client);
    const transport = new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    res.on('close',() => { void transport.close(); void server.close(); });
    try { await server.connect(transport); await transport.handleRequest(req,res,req.body); }
    catch { if (!res.headersSent) res.status(500).json({jsonrpc:'2.0',id:null,error:{code:-32603,message:'MCP request failed'}}); }
  });
  for (const method of ['get','delete']) app[method]('/mcp',(_req,res) => res.status(405).set('Allow','POST').end());
  return app;
}
