import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/inkroom.mjs', import.meta.url));

// Mock every fetch in the child CLI, so no live service or paid task is touched.
async function localClient(tool, input, content) {
  const directory = await mkdtemp(join(tmpdir(), 'inkroom-model-name-test-'));
  try {
    const stub = join(directory, 'fetch-stub.mjs');
    await writeFile(stub, `
globalThis.fetch = async (url, options = {}) => {
  if (String(url) === 'https://inkroom.ai/api/settings') {
    return new Response(JSON.stringify({data:{endpoints:{mcpUrl:'https://mcp.inkroom.ai'}}}), {status:200});
  }
  if (String(url) !== 'https://mcp.inkroom.ai/' || options.method !== 'POST') throw new Error('Unexpected network target');
  const request = JSON.parse(options.body);
  if (request.method !== 'tools/call') throw new Error('Unexpected tool discovery');
  return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result:{structuredContent:${JSON.stringify(content)}}}), {status:200});
};
`);
    const argumentsFile = join(directory, 'arguments.json');
    await writeFile(argumentsFile, JSON.stringify(input));
    const output = JSON.parse(execFileSync(process.execPath, [
      '--import', stub, script, 'call', '--tool', tool, '--arguments', argumentsFile, '--output', join(directory, 'output'),
    ], { encoding: 'utf8', env: { ...process.env, INKROOM_MCP_TOKEN: 'synthetic-model-test', INKROOM_STATE_DIR: directory } }));
    assert.equal(output.ok, true);
    return { request: JSON.parse(await readFile(output.requestPath)), response: JSON.parse(await readFile(output.responsePath)), summary: output.summary };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const choices = [
  ['public model', 'generate_image', { action: 'preview', model: 'gemini-2.5-flash-image', prompt: 'original prompt' }],
  ['original model', 'generate_image', { action: 'preview', model: 'nano-upstream-image-v1', prompt: 'original prompt' }],
  ['historical alias', 'derive_image', { action: 'preview', model: 'nano-previous-public-name', prompt: 'original prompt' }],
  ['model comparison', 'batch_generate', { action: 'preview', items: [
    { model: 'gemini-2.5-flash-image', prompt: 'same prompt' },
    { model: 'nano-upstream-image-v1', prompt: 'same prompt' },
    { model: 'nano-previous-public-name', prompt: 'same prompt' },
  ] }],
  ['server default', 'generate_image', { action: 'preview', prompt: 'original prompt' }],
  ['native preview', 'generate_image', { action: 'preview', prompt: 'original prompt', deliveryMode: 'native' }],
  ['single receipt execution', 'generate_image', { action: 'auto', requestId: 'original-preview' }],
  ['edit receipt execution', 'derive_image', { action: 'run', requestId: 'original-preview' }],
  ['processing receipt execution', 'upscale_image', { action: 'auto', requestId: 'original-preview' }],
  ['batch receipt execution', 'batch_generate', { action: 'run', batchId: 'original-batch' }],
  ['receipt wait', 'wait_images', { batchId: 'original-batch', cursor: 'original-cursor' }],
];
for (const [name, tool, input] of choices) {
  test(`WorkBuddy CLI preserves ${name} and the server public name/quote`, async () => {
    const quote = { model: 'gemini-2.5-flash-image', maxPoints: 5 };
    const result = await localClient(tool, input, quote);
    assert.equal(result.request.method, 'tools/call');
    const expected = { ...input };
    if ((!('requestId' in input) && !('batchId' in input) || tool === 'wait_images') && input.deliveryMode === undefined) expected.deliveryMode = 'links';
    assert.deepEqual(result.request.params, { name: tool, arguments: expected });
    assert.deepEqual(result.response.result.structuredContent, quote);
    assert.deepEqual(result.summary.result.structuredContent, quote);
  });
}

test('WorkBuddy CLI keeps new dynamically configured public catalog names and prices', async () => {
  const catalog = { models: [{ model: 'new-configured-public-model', pointCost: 7 }] };
  const result = await localClient('list_models', {}, catalog);
  assert.deepEqual(result.request.params, { name: 'list_models', arguments: {} });
  assert.deepEqual(result.response.result.structuredContent, catalog);
  assert.deepEqual(result.summary.result.structuredContent, catalog);
});
