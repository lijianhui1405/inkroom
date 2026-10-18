import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn, execFile} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = resolve(root, 'src/cli.mjs');
const skill = resolve(root, 'skills/inkroom-prompts/scripts/prompts.mjs');
const run = promisify(execFile);
// Exercise the real CLI transports and Skill process without contacting a
// hosted service or supplier. The returned prompt exposes the actual URL that
// PromptClient selected, so a missing env handoff cannot pass unnoticed.
const preload = 'data:text/javascript,' + encodeURIComponent(`
globalThis.fetch = async (url, options) => {
  if (options.credentials !== 'omit' || options.redirect !== 'error' || options.headers.Authorization) throw new Error('Unexpected request policy');
  const value = options.method === 'POST'
    ? {kind:'optimized', prompt:String(url), model:'fixture', exampleImageUrl:null}
    : {kind:'library', items:[{id:'fixture',title:'Fixture',prompt:String(url)}]};
  return new Response(JSON.stringify(value), {headers:{'Content-Type':'application/json'}});
};`);
function environment(origin) {
  return {PATH:process.env.PATH || '', ...(origin === undefined ? {} : {INKROOM_PROMPTS_ORIGIN:origin})};
}
async function assertTools(client, origin) {
  assert.equal(client.getServerVersion().version, '0.1.0-preview.2');
  const search = await client.callTool({name:'search_prompts', arguments:{query:'poster'}});
  assert.equal(search.isError, undefined);
  assert.equal(search.structuredContent.items[0].prompt, origin + '/api/prompts/assistant/search?query=poster&limit=3');
  const optimized = await client.callTool({name:'optimize_prompt', arguments:{query:'poster'}});
  assert.equal(optimized.structuredContent.prompt, origin + '/api/prompts/assistant/optimize');
  assert.equal(optimized.structuredContent.exampleImageUrl, null);
}
async function availablePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}
async function waitForListener(child) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('CLI listener did not start')), 5000);
    let stderr = '';
    const onData = chunk => { stderr += chunk; if (stderr.includes('InkRoom Prompts MCP: http://127.0.0.1:')) finish(); };
    const onExit = () => finish(new Error('CLI exited before listening'));
    function finish(error) {
      clearTimeout(timeout); child.stderr.off('data', onData); child.off('exit', onExit);
      error ? reject(error) : resolve();
    }
    child.stderr.on('data', onData); child.once('exit', onExit);
  });
}

for (const origin of [undefined, 'https://inkroom.top']) {
  const selected = origin || 'https://inkroom.ai';
  const label = origin ? 'optional standby origin' : 'default origin without env';
  test('STDIO CLI uses ' + label, {timeout:15000}, async () => {
    const client = new Client({name:'origin-stdio-test',version:'1'});
    const transport = new StdioClientTransport({command:process.execPath,args:['--import',preload,cli],env:environment(origin),stderr:'pipe'});
    try { await client.connect(transport); await assertTools(client, selected); }
    finally { await client.close(); }
  });
  test('local HTTP CLI uses ' + label, {timeout:15000}, async () => {
    const port = await availablePort();
    const child = spawn(process.execPath, ['--import',preload,cli,'--http',String(port)], {env:environment(origin),stdio:['ignore','pipe','pipe']});
    const client = new Client({name:'origin-http-test',version:'1'});
    try {
      await waitForListener(child);
      await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
      await assertTools(client, selected);
    } finally {
      await client.close();
      if (child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    }
  });
  test('standalone Skill uses ' + label, {timeout:15000}, async () => {
    for (const action of ['search','optimize']) {
      const {stdout,stderr} = await run(process.execPath, ['--import',preload,skill,action,'poster'], {env:environment(origin),timeout:5000});
      assert.equal(stderr, '');
      const value = JSON.parse(stdout);
      if (action === 'search') assert.equal(value.items[0].prompt, selected + '/api/prompts/assistant/search?query=poster&limit=3');
      else assert.equal(value.prompt, selected + '/api/prompts/assistant/optimize');
    }
  });
}

test('all executable entry points reject invalid optional origins before networking', {timeout:15000}, async () => {
  for (const origin of ['http://example.test','https://user:pass@inkroom.top','https://inkroom.top/path','https://inkroom.top/?x=1','https://inkroom.top/#fragment']) {
    for (const args of [[cli],[cli,'--http','8788'],[skill,'search','poster']]) {
      await assert.rejects(run(process.execPath, ['--import',preload,...args], {env:environment(origin),timeout:2000}), error => {
        assert.equal(error.code, 1, 'must reject the origin, not merely time out');
        if (args[0] === skill) assert.equal(JSON.parse(error.stdout).error.code, 'invalid_origin');
        else { assert.equal(error.stdout, ''); assert.match(error.stderr, /Could not start InkRoom Prompts MCP/); }
        return true;
      });
    }
  }
});
