import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/inkroom.mjs', import.meta.url));

async function invoke(command, { tool, input = {}, token = '', saved = '', status = 200, offline = false, topic } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'inkroom-public-capabilities-'));
  try {
    const calls = join(directory, 'calls.jsonl');
    const stub = join(directory, 'fetch-stub.mjs');
    await writeFile(stub, `
import {appendFileSync} from 'node:fs';
globalThis.fetch = async (url, options = {}) => {
  if (${offline}) throw new Error('offline check attempted a network request');
  const call = {url:String(url),headers:options.headers || {},body:options.body ? JSON.parse(options.body) : null};
  appendFileSync(${JSON.stringify(calls)}, JSON.stringify(call)+'\\n');
  if (String(url) === 'https://inkroom.ai/api/settings') return new Response(JSON.stringify({data:{endpoints:{mcpUrl:'https://mcp.inkroom.ai'}}}),{status:200});
  if (String(url) !== 'https://mcp.inkroom.ai/' || options.method !== 'POST') throw new Error('Unexpected network target');
  return new Response(JSON.stringify({jsonrpc:'2.0',id:call.body.id,result:{structuredContent:{scope:'public_catalog',officialPricing:{status:'not_verified'}}}}),{status:${status}});
};
`);
    if (saved) await writeFile(join(directory, 'mcp-token'), saved);
    const args = ['--import', stub, script, command, '--output', join(directory, 'output')];
    if (command === 'call') {
      const argumentsFile = join(directory, 'arguments.json');
      await writeFile(argumentsFile, JSON.stringify(input));
      args.push('--tool', tool, '--arguments', argumentsFile);
    }
    if (topic) args.push('--topic', topic);
    const result = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, INKROOM_MCP_TOKEN: token, INKROOM_STATE_DIR: directory } });
    assert.equal(result.signal, null, result.stderr);
    const output = JSON.parse(result.stdout);
    let requests = [];
    try { requests = (await readFile(calls, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return { code: result.status, output, requests };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

for (const [label, command, tool, input] of [
  ['discovery', 'tools', '', {}], ['models', 'models', 'list_models', {}],
  ['capabilities', 'capabilities', 'help', {topic:'quickstart'}],
  ['model tool', 'call', 'list_models', {}], ['help tool', 'call', 'help', {topic:'billing'}],
  ['default public prompt search', 'call', 'prompts', {}],
  ['public prompt search', 'call', 'prompts', {action:'search',scope:'recommended',keyword:'coffee'}],
  ['public prompt get', 'call', 'prompts', {action:'get',id:'public-id'}],
]) {
  test(`Node Skill ${label} works without credentials or environment endpoint configuration`, async () => {
    const {code, output, requests} = await invoke(command, {tool,input});
    assert.equal(code, 0); assert.equal(output.ok, true);
    assert.equal(requests.length, 2);
    const request = requests[1];
    assert.equal(Object.hasOwn(request.headers, 'Authorization'), false);
    assert.equal(request.body.method, command === 'tools' ? 'tools/list' : 'tools/call');
    if (command !== 'tools') assert.deepEqual(request.body.params, {name:tool,arguments:input});
    assert.deepEqual(output.summary.result.structuredContent.officialPricing, {status:'not_verified'});
    assert.deepEqual(output.media, []);
    assert.equal(output.generationAutomaticallyRetried, false);
  });
}

for (const [tool, input] of [
  ['account',{}], ['generation_status',{}], ['wait_images',{requestId:'private'}],
  ['spending_policy',{}], ['generate_image',{action:'preview'}], ['derive_image',{action:'preview'}],
  ['upscale_image',{action:'preview'}], ['reverse_prompt',{action:'get'}],
  ['prompts',{scope:'mine'}], ['prompts',{scope:'favorites'}], ['prompts',{action:'optimize'}],
  ['prompts',{action:1}], ['prompts',{scope:true}],
  ['prompts',{action:null}], ['prompts',{scope:null}],
]) {
  test(`Node Skill keeps ${tool} ${JSON.stringify(input)} private before network`, async () => {
    const {code, output, requests} = await invoke('call', {tool,input});
    assert.equal(code, 1); assert.equal(output.error, 'authorization_required');
    assert.deepEqual(requests, []);
  });
}

for (const source of ['environment','saved']) {
  test(`Node Skill preserves invalid ${source} credentials and never retries anonymously`, async () => {
    const {code, output, requests} = await invoke('models', {status:401,...(source === 'saved' ? {saved:'synthetic-invalid'} : {token:'synthetic-invalid'})});
    assert.equal(code, 1); assert.equal(output.error, 'invalid_token');
    assert.equal(requests.length, 2);
    assert.equal(requests[1].headers.Authorization, 'Bearer synthetic-invalid');
  });
}

for (const command of ['help','self-test']) {
  test(`Node Skill ${command} remains offline and credential free`, async () => {
    const {code, requests} = await invoke(command,{offline:true});
    assert.equal(code, 0); assert.deepEqual(requests, []);
  });
}
