#!/usr/bin/env node
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createPromptServer} from './server.mjs';
import {PromptClient} from './client.mjs';
const args = process.argv.slice(2);
try {
  if (args.length === 0) {
    await createPromptServer(new PromptClient({origin:process.env.INKROOM_PROMPTS_ORIGIN})).connect(new StdioServerTransport());
  } else if (args.length === 2 && args[0] === '--http' && /^\d+$/.test(args[1]) && Number(args[1]) > 0 && Number(args[1]) < 65536) {
    const {createHttpApp} = await import('./http.mjs');
    createHttpApp(new PromptClient({origin:process.env.INKROOM_PROMPTS_ORIGIN})).listen(Number(args[1]),'127.0.0.1',() => console.error(`InkRoom Prompts MCP: http://127.0.0.1:${args[1]}/mcp`)).on('error',() => {console.error('Could not start MCP listener.');process.exitCode=1;});
  } else if (args.length === 1 && ['--help','-h'].includes(args[0])) {
    console.log('inkroom-prompts          MCP over standard input/output\ninkroom-prompts --http PORT   Loopback Streamable HTTP\nNo account, login, API key or Token is required.');
  } else { console.error('Invalid arguments. Use --help.'); process.exitCode=2; }
} catch { console.error('Could not start InkRoom Prompts MCP.'); process.exitCode=1; }
