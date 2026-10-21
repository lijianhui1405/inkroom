import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtemp, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveMedia } from '../scripts/delivery.mjs';
import { downloadOriginal, publicAddress } from '../scripts/download.mjs';
import { validateImage } from '../scripts/image.mjs';
import { resumeWorkflow, continuation } from '../scripts/workflow.mjs';
import { parseMcp, defaultDelivery, compact } from '../scripts/inkroom.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
function response(statusCode, bytes, headers = {}) {
  return Object.assign(Readable.from([bytes]), { statusCode, headers: { 'content-length': String(bytes.length), ...headers } });
}
async function temporary(run) {
  const directory = await mkdtemp(join(tmpdir(), 'inkroom-market-test-'));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
function page(indices, complete, nextAction) {
  return { result: { structuredContent: { complete, resultManifest: {
    requestedImages: 50,
    inputs: Array.from({ length: 25 }, (_, index) => ({ index, taskId: `task-${index}`, count: 2 })),
    results: Array.from({ length: 50 }, (_, index) => ({ resultId: `img-${index}`, inputIndex: Math.floor(index / 2), imageIndex: index % 2, status: 'ready', bytes: png.length })),
  }, ...(nextAction ? { nextAction } : {}) }, content: indices.map((index) => ({
    type: 'resource_link', uri: `https://static.inkroom.ai/image/${index}?signature=old`, size: png.length,
    _meta: { 'inkroom/image': { resultId: `img-${index}`, taskId: `task-${Math.floor(index / 2)}`, inputIndex: Math.floor(index / 2), index: index % 2 } },
  })) } };
}

test('50 results resume in two pages, keep identities despite identical hashes, no generation call', async () => temporary(async (directory) => {
  const args = { batchId: 'original-batch', cursor: 'opaque-cursor', waitSeconds: 45, deliveryMode: 'links' };
  const first = page(Array.from({ length: 32 }, (_, i) => i), false, { tool: 'wait_images', arguments: args });
  const second = page(Array.from({ length: 18 }, (_, i) => i + 32), true);
  const record = join(directory, 'first.response');
  await writeFile(record, JSON.stringify(first));
  let gets = 0, calls = 0;
  const result = await resumeWorkflow({ value: first, record, directory, compact,
    saveMedia: (value, output) => saveMedia(value, output, { get: async () => { gets++; return response(200, png); } }),
    request: async (next) => {
      calls++; assert.equal(next.name, 'wait_images'); assert.deepEqual(next.arguments, args);
      const nextRecord = join(directory, 'second.response'); await writeFile(nextRecord, JSON.stringify(second));
      return { value: second, record: nextRecord };
    },
  });
  assert.equal(calls, 1); assert.equal(gets, 50);
  assert.equal(result.originalsSaved, 50); assert.equal(result.media.length, 50);
  assert.equal(new Set(result.media.map((item) => item.resultId)).size, 50);
  assert.equal(new Set(result.media.map((item) => item.sha256)).size, 1);
  assert.equal(result.allOriginalsSaved, true);
  const checkpoint = JSON.parse(await readFile(result.checkpoint));
  assert.equal(checkpoint.media.length, 50); assert.equal(checkpoint.latestResponse, join(directory, 'second.response'));
}));

test('strong ETag interruption resumes exact byte range with no authorization header', async () => temporary(async (directory) => {
  const split = 24;
  let calls = 0;
  const get = async (_, headers) => {
    calls++; assert.equal(headers.Authorization, undefined);
    if (calls === 1) {
      assert.equal(headers.Range, undefined);
      const stream = Readable.from((async function* () { yield png.subarray(0, split); throw new Error('socket interrupted'); })());
      return Object.assign(stream, { statusCode: 200, headers: { 'content-length': String(png.length), etag: '"original-v1"' } });
    }
    assert.equal(headers.Range, `bytes=${split}-`); assert.equal(headers['If-Range'], '"original-v1"');
    return response(206, png.subarray(split), { etag: '"original-v1"', 'content-range': `bytes ${split}-${png.length - 1}/${png.length}` });
  };
  assert.deepEqual(await downloadOriginal('https://static.inkroom.ai/a', directory, { resultId: 'stable', expectedBytes: png.length }, get), png);
  assert.equal(calls, 2);
}));

test('server returning 200 to a range request replaces the partial bytes', async () => temporary(async (directory) => {
  let calls = 0;
  const get = async () => {
    if (++calls === 1) return Object.assign(Readable.from((async function* () { yield png.subarray(0, 12); throw new Error('cut'); })()), { statusCode: 200, headers: { etag: '"v1"' } });
    return response(200, png, { etag: '"v2"' });
  };
  assert.deepEqual(await downloadOriginal('https://static.inkroom.ai/a', directory, { resultId: 'changed' }, get), png);
}));

test('empty 200 and corrupt image are not accepted; 404 stops retries', async () => temporary(async (directory) => {
  let calls = 0;
  await assert.rejects(downloadOriginal('https://static.inkroom.ai/a', directory, {}, async () => { calls++; return response(404, Buffer.alloc(0)); }), (error) => error.details.httpStatus === 404);
  assert.equal(calls, 1);
  await assert.rejects(downloadOriginal('https://static.inkroom.ai/a', directory, {}, async () => response(200, Buffer.alloc(0))), (error) => error.code === 'download_empty');
  assert.throws(() => validateImage(png.subarray(0, 30)), /truncated|incomplete/);
  const corrupt = Buffer.from(png); corrupt[45] ^= 1;
  assert.throws(() => validateImage(corrupt), /checksum/);
}));

test('preview is separate, complete without an original cannot report all images saved', async () => temporary(async (directory) => {
  const value = { result: { structuredContent: { complete: true, requestedImages: 1 }, content: [{ type: 'image', data: png.toString('base64') }] } };
  const result = await resumeWorkflow({ value, record: join(directory, 'preview.response'), directory, compact, saveMedia, request: () => assert.fail('must not call generation') });
  assert.equal(result.media[0].mediaKind, 'preview'); assert.equal(result.allOriginalsSaved, false);
  assert.equal(result.originalsSaved, 0); assert.equal(result.media[0].decoded, false);
}));

test('resume never follows a paid nextAction, validates prior saved files', async () => temporary(async (directory) => {
  assert.equal(continuation({ result: { structuredContent: { nextAction: { tool: 'generate_image', arguments: { action: 'run' } } } } }), null);
  const path = join(directory, 'changed.png'); await writeFile(path, 'changed');
  const result = await resumeWorkflow({ value: { result: { structuredContent: { complete: true, requestedImages: 1 } } },
    record: join(directory, 'current.response'), directory, compact, saveMedia, request: () => assert.fail(),
    prior: [{ saved: true, source: 'original_link', resultId: 'img', path, bytes: png.length, sha256: 'old' }],
  });
  assert.equal(result.ok, false); assert.equal(result.media[0].errorCode, 'local_file_unverified');
}));

test('public addresses and live delivery defaults; SSE preserves raw cursor', () => {
  for (const address of ['127.0.0.1', '10.2.3.4', '172.20.1.1', '192.168.2.3', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fd00::1', 'fe80::1']) assert.equal(publicAddress(address), false);
  assert.equal(publicAddress('8.8.8.8'), true); assert.equal(publicAddress('2606:4700::1111'), true);
  const input = {}; defaultDelivery('batch_generate', input); assert.equal(input.deliveryMode, 'links');
  const native = { deliveryMode: 'native' }; defaultDelivery('wait_images', native); assert.equal(native.deliveryMode, 'native');
  assert.equal(parseMcp(Buffer.from('data: {"result":{"cursor":"untouched"}}\n\n')).result.cursor, 'untouched');
});

test('CLI executes through a symlink and emits actual versioned self-test output', async () => temporary(async (directory) => {
  const entry = join(directory, 'inkroom-alias.mjs');
  await symlink(fileURLToPath(new URL('../scripts/inkroom.mjs', import.meta.url)), entry);
  const result = JSON.parse(execFileSync(process.execPath, [entry, 'self-test'], { encoding: 'utf8' }));
  const skill = await readFile(new URL('../SKILL.md', import.meta.url), 'utf8');
  const expectedVersion = skill.match(/^\s+version:\s*["']?(\d+\.\d+\.\d+)["']?\s*$/m)?.[1];
  assert.match(expectedVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(result.ok, true); assert.equal(result.version, expectedVersion);
  assert.equal(result.networkUsed, false); assert.equal(result.authorizationRead, false);
}));

test('original download uses at most two workers and verified cache survives a signed URL refresh', async () => temporary(async (directory) => {
  let active = 0, peak = 0, calls = 0;
  const get = async () => {
    calls++; active++; peak = Math.max(peak, active);
    const stream = Readable.from((async function* () {
      try { await new Promise((accept) => setImmediate(accept)); yield png; }
      finally { active--; }
    })());
    return Object.assign(stream, { statusCode: 200, headers: { 'content-length': String(png.length) } });
  };
  const value = page([0,1,2], false, { tool: 'wait_images', arguments: { cursor: 'next' } });
  const first = await saveMedia(value, directory, { get });
  assert.equal(peak, 2); assert.equal(calls, 3); assert.ok(first.every((item) => item.saved));
  for (const item of value.result.content) item.uri = item.uri.replace('old', 'new');
  const second = await saveMedia(value, directory, { get: () => assert.fail('verified originals must be reused') });
  assert.equal(second.length, 3); assert.ok(second.every((item) => item.saved));
}));
